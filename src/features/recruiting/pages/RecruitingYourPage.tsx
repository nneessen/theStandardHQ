// Recruiting → "Your Page" tab.
// One obvious, guided home for everything about an agent's public recruiting
// page: their link/slug, brand identity, look & feel, booking & contact,
// display options, and an optional custom domain — all as a single
// step-by-step wizard built for non-technical users.

import { Link } from "@tanstack/react-router";
import { SectionShell, PillButton } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { RecruitingPageWizard } from "../components/RecruitingPageWizard";

export function RecruitingYourPage() {
  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <div className="flex flex-col gap-5">
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

          {/* Guided setup wizard */}
          <RecruitingPageWizard />
        </div>
      </div>
    </SectionShell>
  );
}
