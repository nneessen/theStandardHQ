// Recruiting → "Your Page" tab.
// One obvious home for everything about an agent's public recruiting page:
// their link + URL slug, and custom (white-label) domains. The custom-domain
// "Add domain" CTA opens the full-page setup wizard.

import { Link } from "@tanstack/react-router";
import { SectionShell, PillButton } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { RecruitingLinkPanel } from "../components/RecruitingLinkPanel";
import { CustomDomainManager } from "@/features/settings";

export function RecruitingYourPage() {
  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Header + tab nav */}
          <header className="flex flex-col gap-3">
            <div>
              <Cap>RECRUITING</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Your Page
              </h1>
            </div>
            <div className="flex items-center gap-1.5">
              <Link to="/recruiting">
                <PillButton tone="ghost" size="sm">
                  Pipeline
                </PillButton>
              </Link>
              <PillButton tone="black" size="sm">
                Your Page
              </PillButton>
            </div>
          </header>

          {/* Recruiting link + slug */}
          <section className="rounded-lg border border-v2-ring bg-v2-card p-4">
            <RecruitingLinkPanel />
          </section>

          {/* Custom (white-label) domain */}
          <section className="rounded-lg border border-v2-ring bg-v2-card p-4">
            <CustomDomainManager />
          </section>
        </div>
      </div>
    </SectionShell>
  );
}
