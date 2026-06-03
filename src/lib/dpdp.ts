// DPDP Act 2023 — shared constants for SMB Connect's data-protection flows.
// The grievance/Data Protection contact is platform-wide (single tenant).

import { supabase } from "@/integrations/supabase/client";

export const CONSENT_VERSION = "1.0";

export const GRIEVANCE_EMAIL = "grievance@smbconnect.in";

// Purposes recorded against a consent record, by the surface that captured it.
export const CONSENT_PURPOSE = {
  registration: "account_registration",
  association: "association_onboarding",
  company: "company_onboarding",
} as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSE)[keyof typeof CONSENT_PURPOSE];

// Data-principal request types (DPDP rights).
export const DATA_REQUEST_TYPES = [
  { value: "access", label: "Access my data", description: "Get a copy of the personal data SMB Connect holds about you." },
  { value: "correction", label: "Correct my data", description: "Ask us to correct inaccurate or incomplete information." },
  { value: "erasure", label: "Erase my data", description: "Ask us to delete your personal data, subject to legal retention." },
  { value: "withdraw_consent", label: "Withdraw consent", description: "Withdraw the consent you gave for processing your data." },
] as const;

export const DATA_REQUEST_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DATA_REQUEST_TYPES.map((t) => [t.value, t.label]),
);

/**
 * Best-effort: record a consent event server-side (captures IP + user-agent).
 * The checkbox is the hard gate; this stores the proof. Never blocks the
 * calling flow on failure — failures are logged, not surfaced to the user.
 */
export async function recordConsent(email: string, purpose: ConsentPurpose): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("record-consent", {
      body: { email: email.trim().toLowerCase(), purpose, consent_version: CONSENT_VERSION },
    });
    if (error) console.error("recordConsent failed:", error.message);
  } catch (err) {
    console.error("recordConsent error:", err);
  }
}
