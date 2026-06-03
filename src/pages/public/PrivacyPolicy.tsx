import { PolicyLayout } from "@/components/PolicyLayout";
import { GRIEVANCE_EMAIL } from "@/lib/dpdp";

export default function PrivacyPolicy() {
  return (
    <PolicyLayout title="Privacy Policy" lastUpdated="June 3, 2026">
      <p>
        SMB Connect ("we", "us", "our") values your privacy. This Privacy Policy explains what
        information we collect through the Platform at smbconnect.in, how we use it, with
        whom we share it, and the choices available to you. It is published in accordance with
        India's Digital Personal Data Protection Act, 2023 (the "DPDP Act"). For the personal
        data you provide, SMB Connect acts as the <strong>Data Fiduciary</strong> and you are
        the <strong>Data Principal</strong>. We process your personal data on the basis of the
        consent you give us, for the lawful purposes described below.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>a. Information you provide</h3>
      <ul>
        <li>Account details: name, email address, mobile number, password.</li>
        <li>Profile details: job title, company, associations, photo, bio.</li>
        <li>Business details: company name, registration, industry, contact details.</li>
        <li>Payment details: handled by our PCI-DSS compliant payment partners — we do not store full card numbers.</li>
        <li>Content: posts, messages, event registrations, uploaded documents.</li>
        <li>Communications with support.</li>
      </ul>
      <h3>b. Information collected automatically</h3>
      <ul>
        <li>Log data: IP address, browser type, device type, pages viewed, referring URL.</li>
        <li>Cookies and similar technologies used for session management, analytics, and preferences.</li>
        <li>Usage data such as feature interactions and approximate geolocation inferred from IP.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide, maintain, and improve the Platform.</li>
        <li>To authenticate users and secure accounts.</li>
        <li>To process payments, subscriptions, and event registrations.</li>
        <li>To enable discovery, networking, and communications between members.</li>
        <li>To send service announcements, invitations, and relevant updates.</li>
        <li>To analyze usage and improve features.</li>
        <li>To comply with legal obligations and enforce our Terms.</li>
      </ul>

      <h2>3. Sharing of Information</h2>
      <p>We share information only in the following circumstances:</p>
      <ul>
        <li>
          <strong>Within the Platform:</strong> Profile information, posts, and directory
          listings are visible to other members and administrators as determined by your
          privacy settings and the nature of the content.
        </li>
        <li>
          <strong>Service providers:</strong> Vetted third parties who process data on our
          behalf, including hosting, payment processing, email and WhatsApp delivery,
          analytics, and customer support — under contractual confidentiality obligations.
        </li>
        <li>
          <strong>Legal compliance:</strong> When required by law, court order, or to protect
          the rights, property, or safety of SMB Connect, our users, or others.
        </li>
        <li>
          <strong>Business transfers:</strong> In connection with a merger, acquisition, or
          sale of assets, subject to equivalent confidentiality and privacy protections.
        </li>
      </ul>
      <p>We do not sell your personal data to third parties.</p>

      <h2>4. Cookies</h2>
      <p>
        We use cookies and similar technologies to keep you signed in, remember preferences,
        understand usage, and improve the Platform. You can control cookies through your
        browser settings. Disabling essential cookies may affect Platform functionality.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We apply reasonable administrative, technical, and physical safeguards — including
        TLS in transit, access controls, and encryption at rest for sensitive fields — to
        protect your data. However, no method of transmission or storage is completely
        secure, and we cannot guarantee absolute security.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain personal data for as long as your account is active or as needed to provide
        services, comply with legal obligations, resolve disputes, and enforce our agreements.
        You may request deletion of your account, subject to legal retention requirements.
      </p>

      <h2>7. Your Rights as a Data Principal</h2>
      <p>Under the DPDP Act, and subject to applicable law, you have the right to:</p>
      <ul>
        <li><strong>Access:</strong> obtain a summary of the personal data we process about you.</li>
        <li><strong>Correction:</strong> request correction of inaccurate or incomplete data.</li>
        <li><strong>Erasure:</strong> request deletion of your personal data, subject to legal retention.</li>
        <li><strong>Withdraw consent:</strong> withdraw any consent you have given, at any time.</li>
        <li><strong>Nominate:</strong> nominate another person to exercise your rights in the event of death or incapacity.</li>
        <li><strong>Grievance redressal:</strong> have your concerns addressed through our grievance process.</li>
      </ul>
      <p>
        The easiest way to exercise these rights is from within your account, under{" "}
        <strong>Account Settings → Privacy &amp; My Data</strong>, where you can raise a request
        and track its status. You may also email our Grievance Officer at{" "}
        <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a> from your registered email
        address. We aim to action requests within 30 days.
      </p>

      <h2>8. Consent &amp; Its Withdrawal</h2>
      <p>
        Where we rely on your consent, we obtain it through a clear affirmative action at the
        point of collection (for example, the consent notice shown during sign-up), and we keep
        a record of that consent. You may withdraw your consent at any time; doing so will not
        affect the lawfulness of processing carried out before withdrawal. Withdrawing consent
        that is necessary to provide the service may mean we can no longer offer you that service.
      </p>

      <h2>9. Grievance Officer</h2>
      <p>
        In accordance with the DPDP Act, you may contact our Data Protection / Grievance Officer
        for any questions, requests, or complaints regarding your personal data:
      </p>
      <ul>
        <li><strong>Grievance Officer, SMB Connect</strong></li>
        <li>Email: <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a></li>
      </ul>
      <p>
        If your grievance is not resolved to your satisfaction within 90 days, you may make a
        complaint to the Data Protection Board of India.
      </p>

      <h2>10. Children's Privacy</h2>
      <p>
        The Platform is not intended for individuals under 18. We do not knowingly collect
        personal data from children. If you believe we have inadvertently collected such
        information, please contact us to have it removed.
      </p>

      <h2>11. International Transfers</h2>
      <p>
        Data may be processed and stored in data centres located outside your country of
        residence. Where required by law, we put appropriate safeguards in place for such
        transfers.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be posted
        on this page with an updated effective date, and — where appropriate — notified to
        you via email or through the Platform.
      </p>

      <h2>13. Contact Us</h2>
      <p>
        General questions about this Privacy Policy? Write to{" "}
        <a href="mailto:support@smbconnect.in">support@smbconnect.in</a>. For data-protection
        requests and grievances, please contact our Grievance Officer at{" "}
        <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>.
      </p>
    </PolicyLayout>
  );
}
