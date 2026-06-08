// src/features/the-standard-team/LicensingHubPage.tsx
// Free Licensing hub. Owns the SectionShell + page header + top tab bar.
// Tabs: SureLC (free) · My Documents (free) · Writing Numbers (Pro/Team, gated inside the tab).

import { useState } from "react";
import { Link2, FileText, BarChart3 } from "lucide-react";
import { SectionShell } from "@/components/v2";
import { Board, Cap, T } from "@/components/board";
import { SureLcLinksPanel } from "./components/SureLcLinksPanel";
import { MyDocumentsPanel } from "./components/MyDocumentsPanel";
import { WritingNumbersTab } from "./WritingNumbersTab";

export type LicensingHubTab = "surelc" | "documents" | "writing-numbers";

const TABS: { id: LicensingHubTab; label: string; icon: typeof Link2 }[] = [
  { id: "surelc", label: "SureLC", icon: Link2 },
  { id: "documents", label: "My Documents", icon: FileText },
  { id: "writing-numbers", label: "Writing Numbers", icon: BarChart3 },
];

interface LicensingHubPageProps {
  initialTab?: LicensingHubTab;
}

export function LicensingHubPage({ initialTab }: LicensingHubPageProps) {
  const [tab, setTab] = useState<LicensingHubTab>(initialTab ?? "surelc");

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <div
          className="flex flex-col gap-4"
          style={{ height: "calc(100vh - 8rem)", minHeight: 0 }}
        >
          {/* header + tab bar */}
          <header
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>Licensing</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Licensing
              </h1>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                background: T.tile,
                borderRadius: 9,
                padding: 3,
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 7,
                      border: "none",
                      cursor: "pointer",
                      font: `700 12px ${T.mono}`,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      background: active
                        ? "rgba(91,155,255,0.16)"
                        : "transparent",
                      color: active ? T.blue : T.mut,
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </header>

          {/* active tab body */}
          <Board
            pad={0}
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {tab === "surelc" ? (
              <SureLcLinksPanel />
            ) : tab === "documents" ? (
              <MyDocumentsPanel />
            ) : (
              <WritingNumbersTab />
            )}
          </Board>
        </div>
      </div>
    </SectionShell>
  );
}
