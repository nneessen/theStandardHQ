// src/features/legal/pages/PrivacyPage.tsx
import React from "react";
import { LegalPageLayout } from "../components/LegalPageLayout";

export function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="May 11, 2026">
      <section className="mb-8">
        <p className="mb-4 text-muted-foreground">
          The Standard HQ&trade; (the "Service") is operated by Nick Neessen, an
          individual residing in Denver, Colorado ("Owner," "we," "us," or
          "our"), as an independent commercial software product. The Owner is
          the data controller for all personal information processed by the
          Service.
        </p>
        <p className="mb-4 text-muted-foreground">
          We are committed to protecting your privacy and ensuring the security
          of your personal and business information. This Privacy Policy
          explains how we collect, use, and safeguard your data.
        </p>
        <p className="font-semibold text-foreground">
          Your data is never sold to third parties and is never shared with any
          insurance agency, IMO, FMO, brokerage, or carrier without your express
          consent.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          1. Information We Collect
        </h2>
        <p className="mb-4 text-muted-foreground">
          We collect information that you provide directly when using our
          Service:
        </p>
        <h3 className="mb-2 font-semibold text-foreground">
          Personal Information
        </h3>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>Name and contact information (email, phone, address)</li>
          <li>Date of birth</li>
          <li>Profile photo (optional)</li>
          <li>
            Professional licensing information (license numbers, NPN, state
            licenses)
          </li>
          <li>Social media handles (optional)</li>
        </ul>
        <h3 className="mb-2 font-semibold text-foreground">Business Data</h3>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>Insurance policy information</li>
          <li>Commission and payment records</li>
          <li>Business expenses and receipts</li>
          <li>Performance targets and metrics</li>
          <li>Client information you enter</li>
          <li>Documents you upload</li>
        </ul>
        <h3 className="mb-2 font-semibold text-foreground">
          Automatically Collected Information
        </h3>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>Activity logs (actions taken within the platform)</li>
          <li>
            Email interaction data (open rates, click rates for platform emails)
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          2. How We Use Your Information
        </h2>
        <p className="mb-4 text-muted-foreground">
          We use your information solely to provide and improve our Service:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>To operate and maintain your account</li>
          <li>
            To provide business management features (tracking, analytics,
            reporting)
          </li>
          <li>To send transactional emails (password resets, notifications)</li>
          <li>To improve and optimize the Service</li>
          <li>To respond to your support requests</li>
          <li>To comply with legal obligations</li>
        </ul>
        <p className="font-semibold text-foreground">
          We do not use your data for advertising or sell it to data brokers.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          3. Data Sharing & Third Parties
        </h2>
        <p className="mb-4 text-muted-foreground">
          We share your data only with essential service providers who help us
          operate the platform. We do{" "}
          <span className="font-semibold text-foreground">not</span> share your
          data with any insurance agency, IMO, FMO, brokerage, or carrier —
          including any organization with which the Owner or you are affiliated
          — except where you have expressly directed us to do so or as required
          by law.
        </p>
        <p className="mb-4 text-muted-foreground">
          Our essential service providers are:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Supabase</span> —
            Database hosting, authentication, and file storage
          </li>
          <li>
            <span className="font-medium text-foreground">Vercel</span> —
            Website hosting and delivery
          </li>
          <li>
            <span className="font-medium text-foreground">Mailgun</span> —
            Transactional email delivery
          </li>
          <li>
            <span className="font-medium text-foreground">Google Fonts</span> —
            Typography (no personal data shared)
          </li>
        </ul>
        <p className="mb-4 text-muted-foreground">
          These providers are bound by contractual obligations to protect your
          data and use it only as directed by us.
        </p>
        <p className="text-muted-foreground">
          We may disclose your information if required by law or to protect the
          rights and safety of our users.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          4. Cookies & Tracking
        </h2>
        <p className="mb-4 text-muted-foreground">
          We use minimal cookies necessary for the Service to function:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">
              Authentication cookies
            </span>{" "}
            — Essential for keeping you logged in
          </li>
          <li>
            <span className="font-medium text-foreground">
              Preference cookies
            </span>{" "}
            — Store your theme (dark/light mode) and sidebar preferences
          </li>
        </ul>
        <p className="font-semibold text-foreground">
          We do not use third-party analytics, advertising trackers, or
          marketing cookies.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          5. Data Security
        </h2>
        <p className="mb-4 text-muted-foreground">
          We implement industry-standard security measures to protect your data:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>All data is encrypted in transit (HTTPS/TLS)</li>
          <li>Data is encrypted at rest in our database</li>
          <li>Access controls and authentication requirements</li>
          <li>Regular security reviews and updates</li>
          <li>Row-level security policies in our database</li>
        </ul>
        <p className="text-muted-foreground">
          While we take security seriously, no system is 100% secure. We
          encourage you to use strong passwords and protect your account
          credentials.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          6. Data Retention
        </h2>
        <p className="mb-4 text-muted-foreground">
          We retain your data for as long as your account is active or as needed
          to provide you with our Service. If you request account deletion:
        </p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>Personal data will be deleted within 30 days of your request</li>
          <li>
            Some data may be retained as required by law (financial records,
            audit logs)
          </li>
          <li>Anonymized or aggregated data may be retained for analytics</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          7. Your Rights
        </h2>
        <p className="mb-4 text-muted-foreground">You have the right to:</p>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Access</span> —
            Request a copy of your personal data
          </li>
          <li>
            <span className="font-medium text-foreground">Correction</span> —
            Update or correct inaccurate data
          </li>
          <li>
            <span className="font-medium text-foreground">Deletion</span> —
            Request deletion of your account and data
          </li>
          <li>
            <span className="font-medium text-foreground">Export</span> —
            Request an export of your data in a portable format
          </li>
        </ul>
        <p className="text-muted-foreground">
          To exercise these rights, contact us at{" "}
          <a
            href="mailto:support@thestandardhq.com"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            support@thestandardhq.com
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          8. Children's Privacy
        </h2>
        <p className="text-muted-foreground">
          Our Service is intended for licensed insurance professionals and is
          not designed for use by individuals under 18 years of age. We do not
          knowingly collect personal information from minors.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          9. Changes to This Policy
        </h2>
        <p className="text-muted-foreground">
          We may update this Privacy Policy from time to time. We will notify
          you of any material changes by posting the new policy on this page and
          updating the "Last updated" date. Your continued use of the Service
          after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          10. Contact Us
        </h2>
        <p className="text-muted-foreground">
          If you have questions about this Privacy Policy or how we handle your
          data, please contact us at{" "}
          <a
            href="mailto:support@thestandardhq.com"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            support@thestandardhq.com
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
