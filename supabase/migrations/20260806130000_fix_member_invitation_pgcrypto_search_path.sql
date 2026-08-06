-- pgcrypto lives in the `extensions` schema on this project (confirmed via
-- pg_extension), but these three functions were created with search_path
-- locked to `public` only, so gen_random_bytes()/digest() couldn't resolve
-- and every call raised 42883 "function gen_random_bytes(integer) does not
-- exist" -- surfacing to callers as a bare 500. create_invite_link hit the
-- same class of bug and was fixed in 20260417120001_fix-invite-link-search-path.sql;
-- these three were missed at the time.
--
-- Broke: creating a member invitation, resending one, and verifying/accepting
-- one from the registration link (the entire member-invitation flow).
ALTER FUNCTION public.create_single_member_invitation(uuid, text, text, text, uuid, text, text, text, text)
  SET search_path = public, extensions;

ALTER FUNCTION public.resend_member_invitation_db(uuid, uuid)
  SET search_path = public, extensions;

ALTER FUNCTION public.verify_member_invitation(text)
  SET search_path = public, extensions;

-- Separate, pre-existing bug hit while verifying the fix above: 4 functions
-- (verify_member_invitation, revoke_member_invitation, resend_member_invitation_db,
-- complete_member_invitation) insert a `notes` value into member_invitation_audit,
-- but no migration ever added that column to the original 20251115065426 table --
-- every one of those audit-log inserts has always raised 42703 undefined_column,
-- including inside complete_member_invitation, the step that finishes registration
-- when someone clicks their invite link.
ALTER TABLE public.member_invitation_audit ADD COLUMN IF NOT EXISTS notes TEXT;
