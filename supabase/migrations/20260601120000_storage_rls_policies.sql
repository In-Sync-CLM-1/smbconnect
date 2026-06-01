-- Storage RLS policies for app buckets.
--
-- Bug: storage.objects had RLS enabled but ZERO policies, so every upload was
-- rejected with "new row violates row-level security policy". This broke all
-- file/image posting (association feed, member feed, company feed, messages,
-- events, certificates, association logos). Reads still worked because the
-- buckets are public (served via the public CDN path).
--
-- Fix: public read + authenticated write on the six app buckets. Upload paths
-- are not uniformly foldered by auth.uid() (event-media has no folder,
-- association-logos is foldered by association id), so writes are scoped to
-- "any authenticated member" rather than per-user-folder ownership.
--
-- Idempotent (drop-if-exists guards) so it is safe to re-run.
--
-- NOTE: do NOT "alter table storage.objects enable row level security" here.
-- On hosted Supabase that table is owned by supabase_storage_admin and the
-- migration role (postgres) cannot ALTER it ("must be owner of table objects").
-- RLS is already enabled by the platform; postgres IS allowed to create the
-- policies below.

drop policy if exists "App buckets public read" on storage.objects;
create policy "App buckets public read"
  on storage.objects for select
  to public
  using (
    bucket_id in (
      'profile-images', 'message-attachments', 'event-media',
      'certificates', 'association-logos', 'email-images'
    )
  );

drop policy if exists "App buckets authenticated insert" on storage.objects;
create policy "App buckets authenticated insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in (
      'profile-images', 'message-attachments', 'event-media',
      'certificates', 'association-logos', 'email-images'
    )
  );

drop policy if exists "App buckets authenticated update" on storage.objects;
create policy "App buckets authenticated update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in (
      'profile-images', 'message-attachments', 'event-media',
      'certificates', 'association-logos', 'email-images'
    )
  )
  with check (
    bucket_id in (
      'profile-images', 'message-attachments', 'event-media',
      'certificates', 'association-logos', 'email-images'
    )
  );

drop policy if exists "App buckets authenticated delete" on storage.objects;
create policy "App buckets authenticated delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in (
      'profile-images', 'message-attachments', 'event-media',
      'certificates', 'association-logos', 'email-images'
    )
  );
