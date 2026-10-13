-- profiles.email is not populated, so the sign-up code functions must find accounts via auth.users.
CREATE OR REPLACE FUNCTION public.signup_lookup_user(p_email text)
RETURNS TABLE (id uuid, confirmed boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, (u.email_confirmed_at IS NOT NULL) AS confirmed
  FROM auth.users u
  WHERE lower(u.email) = lower(p_email) AND u.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.signup_lookup_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signup_lookup_user(text) TO service_role;
