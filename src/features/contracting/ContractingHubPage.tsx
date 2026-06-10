// src/features/contracting/ContractingHubPage.tsx
// Contracting Hub — mockup C in the dark board theme: an always-on Action Center
// (Newly Eligible | Approvals Needed) on top, then a My Contracting / My Downline
// segmented view. My Downline is a side-by-side roster + detail.

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileCheck, Users } from "lucide-react";
import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { ActionCenter } from "./components/hub/ActionCenter";
import { MyContractingPanel } from "./components/hub/MyContractingPanel";
import { DownlinePanel } from "./components/hub/DownlinePanel";

export type ContractingTab = "mine" | "downline";

function normalizeTab(tab?: string): ContractingTab {
  return tab === "downline" ? "downline" : "mine";
}

export function ContractingHubPage({ initialTab }: { initialTab?: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ContractingTab>(normalizeTab(initialTab));

  useEffect(() => setTab(normalizeTab(initialTab)), [initialTab]);

  const changeTab = (next: ContractingTab) => {
    setTab(next);
    navigate({ to: "/contracting", search: { tab: next } });
  };

  const tabs: { id: ContractingTab; label: string; icon: typeof FileCheck }[] =
    [
      { id: "mine", label: "My Contracting", icon: FileCheck },
      { id: "downline", label: "My Downline", icon: Users },
    ];

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <div
          className="flex flex-col gap-4"
          style={{ height: "calc(100vh - 7rem)", minHeight: 0 }}
        >
          {/* header + segmented control */}
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
              <Cap>Business</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Contracting
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
              {tabs.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => changeTab(id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 13px",
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

          {/* always-on action center */}
          <ActionCenter />

          {/* segmented body */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {tab === "mine" ? <MyContractingPanel /> : <DownlinePanel />}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

export default ContractingHubPage;
