-- Sign-up verification by 6-digit email code instead of a one-time link.
-- Mail scanners open links before the person does, which burns them; a code cannot be burned that way.
CREATE TABLE IF NOT EXISTS public.signup_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  otp_code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_otps_email_created_idx ON public.signup_otps (email, created_at DESC);

-- Service-role only: RLS on, no policies, no client grants.
ALTER TABLE public.signup_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signup_otps FROM anon, authenticated;
