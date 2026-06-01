// src/features/legal/pages/AccessibilityPage.tsx
import React from "react";
import { LegalPageLayout } from "../components/LegalPageLayout";

export function AccessibilityPage() {
  return (
    <LegalPageLayout title="Accessibility Statement" lastUpdated="May 31, 2026">
      <section className="mb-8">
        <p className="mb-4 text-muted-foreground">
          The Standard HQ&trade; (the "Service") is operated by Nick Neessen, an
          individual residing in Denver, Colorado. We are committed to ensuring
          that our public-facing website is accessible to people with
          disabilities and to providing an inclusive experience for everyone who
          visits.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          Conformance target
        </h2>
        <p className="mb-4 text-muted-foreground">
          We aim to conform to the{" "}
          <a
            href="https://www.w3.org/TR/WCAG21/"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            Web Content Accessibility Guidelines (WCAG) 2.1, Level AA
          </a>
          . These guidelines explain how to make web content more accessible to
          people with a wide range of disabilities, including visual, auditory,
          physical, speech, cognitive, and neurological disabilities.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          Measures we take
        </h2>
        <ul className="mb-4 list-disc pl-6 text-muted-foreground">
          <li>Semantic HTML with labeled landmarks and headings</li>
          <li>Text alternatives for meaningful images</li>
          <li>Labels associated with every form field</li>
          <li>Full keyboard operability with visible focus indicators</li>
          <li>A reduced-motion mode that respects your system preference</li>
          <li>
            Automated accessibility testing (axe-core) plus manual keyboard and
            screen-reader review of our public pages
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          Known limitations
        </h2>
        <p className="mb-4 text-muted-foreground">
          Accessibility is an ongoing effort and some areas of the Service may
          not yet fully meet our target. We actively monitor and remediate
          issues as they are identified, and we welcome reports of any barriers
          you encounter so we can address them.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          Feedback &amp; contact
        </h2>
        <p className="text-muted-foreground">
          If you experience any difficulty accessing any part of this website,
          or have suggestions for how we can improve accessibility, please
          contact us at{" "}
          <a
            href="mailto:support@thestandardhq.com"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            support@thestandardhq.com
          </a>
          . We aim to respond to accessibility feedback within five business
          days.
        </p>
      </section>
    </LegalPageLayout>
  );
}
