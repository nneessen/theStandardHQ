// src/features/workflows/components/WorkflowAdminPage.tsx

import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
import WorkflowManager from "./WorkflowManager";

export default function WorkflowAdminPage() {
  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Board header */}
          <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Cap>AUTOMATION</Cap>
            <h1
              style={{
                font: `800 26px ${T.disp}`,
                color: T.ink,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: 0,
              }}
            >
              Workflows
            </h1>
          </header>

          <div className="flex-1 overflow-hidden bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring">
            <WorkflowManager />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
