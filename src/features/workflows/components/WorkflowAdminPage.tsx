// src/features/workflows/components/WorkflowAdminPage.tsx

import { Settings } from "lucide-react";
import WorkflowManager from "./WorkflowManager";

export default function WorkflowAdminPage() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5">
      <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring dark:border-v2-ring">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-v2-ink dark:text-v2-ink" />
          <h1 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
            Workflow Administration
          </h1>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring">
        <WorkflowManager />
      </div>
    </div>
  );
}
