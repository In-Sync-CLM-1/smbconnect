-- DPDP Act 2023 compliance for SMB Connect.
-- Adds: consent records, data-principal requests, breach notifications,
-- PII access audit log, and a SECURITY DEFINER helper to write audit rows.
-- Access is gated on the existing admin model (admin_users via is_admin_safe()).

-- ---------------------------------------------------------------------------
-- 1. Consent records — proof of consent captured at signup / onboarding.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_identifier  TEXT NOT NULL,                       -- email at time of consent
  consent_version  TEXT NOT NULL DEFAULT '1.0',
  purpose          TEXT NOT NULL,
  consented        BOOLEAN NOT NULL DEFAULT true,
  consented_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at     TIMESTAMPTZ,
  ip_address       TEXT,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON public.consent_records (user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_identifier ON public.consent_records (lower(user_identifier));

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own consent records" ON public.consent_records;
DROP POLICY IF EXISTS "Admins manage consent records" ON public.consent_records;

-- A data principal can see their own consent rows (matched by id or by email).
CREATE POLICY "Users view own consent records"
  ON public.consent_records FOR SELECT
  USING (
    user_id = auth.uid()
    OR lower(user_identifier) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Admins can read/manage everything.
CREATE POLICY "Admins manage consent records"
  ON public.consent_records FOR ALL
  USING (public.is_admin_safe(auth.uid()))
  WITH CHECK (public.is_admin_safe(auth.uid()));

-- Inserts happen server-side via the record-consent edge function (service role,
-- which bypasses RLS), so no public INSERT policy is granted.

-- ---------------------------------------------------------------------------
-- 2. Data-principal requests — access / correction / erasure / withdraw.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email     TEXT NOT NULL,
  user_name      TEXT,
  request_type   TEXT NOT NULL CHECK (request_type IN ('access','correction','erasure','withdraw_consent')),
  details        TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  due_date       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  admin_notes    TEXT,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_requests_user_id ON public.data_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON public.data_requests (status);

ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own data requests" ON public.data_requests;
DROP POLICY IF EXISTS "Users create own data requests" ON public.data_requests;
DROP POLICY IF EXISTS "Admins manage data requests" ON public.data_requests;

CREATE POLICY "Users view own data requests"
  ON public.data_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users create own data requests"
  ON public.data_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage data requests"
  ON public.data_requests FOR ALL
  USING (public.is_admin_safe(auth.uid()))
  WITH CHECK (public.is_admin_safe(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Breach notifications — admin-recorded, plain-language per DPDP.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.breach_notifications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  impact             TEXT NOT NULL,
  remedial_steps     TEXT NOT NULL,
  contact_info       TEXT NOT NULL,
  triggered_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_by_email TEXT,
  affected_user_ids  UUID[] DEFAULT '{}',
  triggered_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.breach_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage breach notifications" ON public.breach_notifications;

CREATE POLICY "Admins manage breach notifications"
  ON public.breach_notifications FOR ALL
  USING (public.is_admin_safe(auth.uid()))
  WITH CHECK (public.is_admin_safe(auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. PII access audit log — purpose-limitation trail (admin-readable).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pii_access_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,            -- who accessed
  accessor_email TEXT,
  table_name     TEXT NOT NULL,
  column_name    TEXT,
  subject_id     UUID,                     -- whose data was accessed
  subject_label  TEXT,
  purpose        TEXT NOT NULL,
  accessed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pii_access_log_accessed_at ON public.pii_access_log (accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pii_access_log_user_id ON public.pii_access_log (user_id);

ALTER TABLE public.pii_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view pii access log" ON public.pii_access_log;

CREATE POLICY "Admins view pii access log"
  ON public.pii_access_log FOR SELECT
  USING (public.is_admin_safe(auth.uid()));

-- Writes go through the SECURITY DEFINER helper below; no direct INSERT policy.

CREATE OR REPLACE FUNCTION public.log_pii_access(
  p_table         TEXT,
  p_column        TEXT,
  p_subject_id    UUID,
  p_subject_label TEXT,
  p_purpose       TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;  -- only log authenticated access
  END IF;
  INSERT INTO public.pii_access_log (user_id, accessor_email, table_name, column_name, subject_id, subject_label, purpose)
  VALUES (
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', ''),
    p_table,
    p_column,
    p_subject_id,
    p_subject_label,
    coalesce(p_purpose, 'view')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_pii_access(TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;
