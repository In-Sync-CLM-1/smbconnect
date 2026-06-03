import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { CONSENT_VERSION, GRIEVANCE_EMAIL } from "@/lib/dpdp";

interface DpdpConsentProps {
  consented: boolean;
  onConsentChange: (consented: boolean) => void;
  disabled?: boolean;
  /** What the data is being collected for, shown in the notice and the checkbox label. */
  purposeText?: string;
}

/**
 * DPDP Act 2023 data-protection notice + mandatory consent checkbox.
 * Reused across the registration and onboarding (association / company) forms.
 */
export function DpdpConsent({
  consented,
  onConsentChange,
  disabled,
  purposeText = "creating and operating your SMB Connect account",
}: DpdpConsentProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck className="h-5 w-5" />
        <h3 className="font-semibold">Data Protection Notice</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Under the Digital Personal Data Protection Act, 2023, we must tell you how your data
        will be used before we collect it.
      </p>

      <div className="max-h-44 overflow-y-auto rounded-md border bg-background p-3 text-sm space-y-3">
        <div>
          <p className="font-medium">What we collect</p>
          <p className="text-muted-foreground">
            Your name, email, mobile number, and the business/association details you provide
            (which may include company registration details such as GST and PAN).
          </p>
        </div>
        <div>
          <p className="font-medium">Why we collect it</p>
          <p className="text-muted-foreground">
            Solely for {purposeText}, to verify your identity, and to enable networking between
            members on the platform.
          </p>
        </div>
        <div>
          <p className="font-medium">How long we keep it</p>
          <p className="text-muted-foreground">
            For as long as your account is active and thereafter only as required by applicable
            law (e.g. tax and regulatory record-keeping).
          </p>
        </div>
        <div>
          <p className="font-medium">Your rights</p>
          <p className="text-muted-foreground">
            You can access, correct, or erase your data, and withdraw this consent at any time
            from <span className="font-medium">Account Settings → Privacy &amp; My Data</span>.
          </p>
        </div>
        <div>
          <p className="font-medium">Grievance redressal</p>
          <p className="text-muted-foreground">
            Contact our Data Protection / Grievance Officer at{" "}
            <span className="font-medium text-primary">{GRIEVANCE_EMAIL}</span>. If unresolved
            within 90 days you may approach the Data Protection Board of India.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="dpdp-consent"
          checked={consented}
          onCheckedChange={(checked) => onConsentChange(checked === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <label htmlFor="dpdp-consent" className="text-sm leading-relaxed cursor-pointer">
          I have read and understood the above notice and I freely consent to the collection and
          processing of my personal data for the stated purpose.{" "}
          <span className="text-xs text-muted-foreground">(Consent v{CONSENT_VERSION})</span>
        </label>
      </div>

      <a
        href="/privacy-policy"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        View full Privacy Policy <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
