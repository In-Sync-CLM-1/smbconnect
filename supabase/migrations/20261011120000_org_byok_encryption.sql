-- Per-organisation bring-your-own-key (BYOK) encryption for DPDP "reasonable
-- safeguards". Same mechanism as IT Helpdesk's Settings > Encryption (pgcrypto,
-- key in Supabase Vault, encrypted-at-rest backup columns kept in sync by a
-- trigger, re-encryption on rotation, live proof), extended so that EACH
-- association and EACH company can bring its own key. An organisation with no
-- key of its own is protected by the platform default key.
--
-- Plaintext columns stay authoritative for every operational read (company
-- email/GST are read by directory, invitations, bulk email, etc.), so nothing
-- is masked and no existing consumer can break; the encrypted copy is added
-- alongside.

create extension if not exists pgcrypto with schema extensions;

-- Platform default key, used by any organisation that has not set its own.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'PII_ENCRYPTION_KEY') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'PII_ENCRYPTION_KEY', 'Platform default PII encryption key');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Key resolution + encrypt/decrypt (internal: not callable by app users)
-- ---------------------------------------------------------------------------
create or replace function public.org_pii_key(p_type text, p_id uuid)
returns text language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets
   where name = 'PII_KEY_' || p_type || '_' || p_id::text limit 1;
  if k is null then
    select decrypted_secret into k from vault.decrypted_secrets
     where name = 'PII_ENCRYPTION_KEY' limit 1;
  end if;
  if k is null then raise exception 'No PII encryption key available'; end if;
  return k;
end $$;

create or replace function public.encrypt_org_pii(plaintext text, p_type text, p_id uuid)
returns bytea language plpgsql security definer set search_path to 'public', 'extensions' as $$
begin
  if plaintext is null or plaintext = '' then return null; end if;
  return extensions.pgp_sym_encrypt(plaintext, public.org_pii_key(p_type, p_id));
end $$;

create or replace function public.decrypt_org_pii(ciphertext bytea, p_type text, p_id uuid)
returns text language plpgsql security definer set search_path to 'public', 'extensions' as $$
begin
  if ciphertext is null then return null; end if;
  return extensions.pgp_sym_decrypt(ciphertext, public.org_pii_key(p_type, p_id));
end $$;

revoke all on function public.org_pii_key(text, uuid) from public, anon, authenticated;
revoke all on function public.encrypt_org_pii(text, text, uuid) from public, anon, authenticated;
revoke all on function public.decrypt_org_pii(bytea, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Encrypted backup columns + triggers
-- ---------------------------------------------------------------------------
alter table public.associations
  add column if not exists contact_email_encrypted bytea,
  add column if not exists contact_phone_encrypted bytea;

alter table public.companies
  add column if not exists email_encrypted bytea,
  add column if not exists phone_encrypted bytea,
  add column if not exists gst_number_encrypted bytea,
  add column if not exists pan_number_encrypted bytea;

create or replace function public.encrypt_association_pii()
returns trigger language plpgsql security definer set search_path to 'public', 'extensions' as $$
begin
  new.contact_email_encrypted := public.encrypt_org_pii(new.contact_email, 'association', new.id);
  new.contact_phone_encrypted := public.encrypt_org_pii(new.contact_phone, 'association', new.id);
  return new;
end $$;

create or replace function public.encrypt_company_pii()
returns trigger language plpgsql security definer set search_path to 'public', 'extensions' as $$
begin
  new.email_encrypted      := public.encrypt_org_pii(new.email, 'company', new.id);
  new.phone_encrypted      := public.encrypt_org_pii(new.phone, 'company', new.id);
  new.gst_number_encrypted := public.encrypt_org_pii(new.gst_number, 'company', new.id);
  new.pan_number_encrypted := public.encrypt_org_pii(new.pan_number, 'company', new.id);
  return new;
end $$;

drop trigger if exists encrypt_association_pii_trigger on public.associations;
create trigger encrypt_association_pii_trigger before insert or update on public.associations
  for each row execute function public.encrypt_association_pii();

drop trigger if exists encrypt_company_pii_trigger on public.companies;
create trigger encrypt_company_pii_trigger before insert or update on public.companies
  for each row execute function public.encrypt_company_pii();

-- ---------------------------------------------------------------------------
-- Which organisations have brought their own key (metadata only, never the key)
-- ---------------------------------------------------------------------------
create table if not exists public.org_encryption_keys (
  org_type       text not null check (org_type in ('association', 'company')),
  org_id         uuid not null,
  set_by         uuid,
  set_at         timestamptz not null default now(),
  rotation_count integer not null default 0,
  primary key (org_type, org_id)
);

alter table public.org_encryption_keys enable row level security;

drop policy if exists "Org admins view own key status" on public.org_encryption_keys;
create policy "Org admins view own key status" on public.org_encryption_keys for select
  using (
    (org_type = 'association' and public.is_association_manager(auth.uid(), org_id))
    or (org_type = 'company' and public.is_company_admin(auth.uid(), org_id))
  );

-- ---------------------------------------------------------------------------
-- Set / remove an organisation's key and re-encrypt its data, atomically.
-- Service role only: the set-org-encryption-key edge function has already
-- verified the caller administers that organisation.
-- ---------------------------------------------------------------------------
create or replace function public.set_org_encryption_key(p_type text, p_id uuid, p_key text, p_user uuid)
returns void language plpgsql security definer set search_path to 'public', 'vault', 'extensions' as $$
declare
  v_name text := 'PII_KEY_' || p_type || '_' || p_id::text;
  v_secret_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'set_org_encryption_key is for the key-management function only';
  end if;
  if p_type not in ('association', 'company') then
    raise exception 'Unknown organisation type %', p_type;
  end if;

  if p_key is null then
    delete from vault.secrets where name = v_name;
    delete from public.org_encryption_keys where org_type = p_type and org_id = p_id;
  else
    select id into v_secret_id from vault.decrypted_secrets where name = v_name limit 1;
    if v_secret_id is null then
      perform vault.create_secret(p_key, v_name, 'Organisation-owned PII key');
    else
      perform vault.update_secret(v_secret_id, p_key, v_name);
    end if;
    insert into public.org_encryption_keys (org_type, org_id, set_by, set_at, rotation_count)
    values (p_type, p_id, p_user, now(), 0)
    on conflict (org_type, org_id) do update
      set set_by = excluded.set_by, set_at = now(),
          rotation_count = public.org_encryption_keys.rotation_count + 1;
  end if;

  -- Existing ciphertext was written under the previous key; re-run the table's
  -- own trigger so it is rewritten under the new one (rotation without this
  -- leaves every older row permanently undecryptable).
  if p_type = 'association' then
    update public.associations set contact_email = contact_email where id = p_id;
  else
    update public.companies set email = email where id = p_id;
  end if;

  insert into public.pii_access_log (user_id, table_name, column_name, subject_id, subject_label, purpose)
  values (p_user, case when p_type = 'association' then 'associations' else 'companies' end,
          'encryption_key', p_id, p_type,
          case when p_key is null then 'Own encryption key removed (platform key restored)'
               else 'Own encryption key set / rotated' end);
end $$;

revoke all on function public.set_org_encryption_key(text, uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Status + live proof, for the organisation's own administrators
-- ---------------------------------------------------------------------------
create or replace function public.org_encryption_admin_check(p_type text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
begin
  return case p_type
    when 'association' then public.is_association_manager(auth.uid(), p_id)
    when 'company' then public.is_company_admin(auth.uid(), p_id)
    else false end;
end $$;

create or replace function public.get_org_encryption_status(p_type text, p_id uuid)
returns table(using_own_key boolean, set_at timestamptz, rotation_count integer)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.org_encryption_admin_check(p_type, p_id) then
    raise exception 'Not authorised for this organisation';
  end if;
  return query
    select k.org_id is not null, k.set_at, coalesce(k.rotation_count, 0)
    from (select 1) x
    left join public.org_encryption_keys k on k.org_type = p_type and k.org_id = p_id;
end $$;

create or replace function public.get_org_encryption_proof(p_type text, p_id uuid)
returns table(real_value text, stored_ciphertext_hex text, ciphertext_bytes integer,
              decrypts_correctly boolean, key_source text)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_own boolean;
begin
  if not public.org_encryption_admin_check(p_type, p_id) then
    raise exception 'Not authorised for this organisation';
  end if;
  v_own := exists (select 1 from public.org_encryption_keys where org_type = p_type and org_id = p_id);

  if p_type = 'association' then
    return query select a.contact_email, encode(a.contact_email_encrypted, 'hex'),
      octet_length(a.contact_email_encrypted),
      public.decrypt_org_pii(a.contact_email_encrypted, 'association', a.id) = a.contact_email,
      case when v_own then 'own' else 'platform' end
    from public.associations a where a.id = p_id;
  else
    return query select c.email, encode(c.email_encrypted, 'hex'),
      octet_length(c.email_encrypted),
      public.decrypt_org_pii(c.email_encrypted, 'company', c.id) = c.email,
      case when v_own then 'own' else 'platform' end
    from public.companies c where c.id = p_id;
  end if;
end $$;

revoke all on function public.org_encryption_admin_check(text, uuid) from public, anon;
revoke all on function public.get_org_encryption_status(text, uuid) from public, anon;
revoke all on function public.get_org_encryption_proof(text, uuid) from public, anon;
grant execute on function public.org_encryption_admin_check(text, uuid) to authenticated;
grant execute on function public.get_org_encryption_status(text, uuid) to authenticated;
grant execute on function public.get_org_encryption_proof(text, uuid) to authenticated;

-- Backfill: encrypt every existing row under the platform default key. The
-- updated_at triggers are paused so "recently updated" ordering is untouched.
alter table public.associations disable trigger update_associations_updated_at;
alter table public.companies disable trigger update_companies_updated_at;
update public.associations set contact_email = contact_email;
update public.companies set email = email;
alter table public.associations enable trigger update_associations_updated_at;
alter table public.companies enable trigger update_companies_updated_at;
