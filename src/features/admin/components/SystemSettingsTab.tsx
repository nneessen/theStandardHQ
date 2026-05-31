// src/features/admin/components/SystemSettingsTab.tsx

import { Zap, ShieldAlert } from "lucide-react";
import { useImo } from "@/contexts/ImoContext";
import { SystemAutomationsConfig } from "./SystemAutomationsConfig";
import { PlatformRevocationControl } from "./PlatformRevocationControl";

export function SystemSettingsTab() {
  const { isSuperAdmin } = useImo();
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* System Automations Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-info/10">
              <Zap className="h-4 w-4 text-info" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-v2-ink">
                System Automations
              </h2>
              <p className="text-[10px] text-v2-ink-muted">
                Configure automated communications for system-level events
              </p>
            </div>
          </div>
          <SystemAutomationsConfig />
        </section>

        {/* Platform Access / RED BUTTON (super-admin only) */}
        {isSuperAdmin && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-destructive/10">
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-v2-ink">
                  Platform Access
                </h2>
                <p className="text-[10px] text-v2-ink-muted">
                  Revoke or restore an organization's access to the platform
                </p>
              </div>
            </div>
            <PlatformRevocationControl />
          </section>
        )}
      </div>
    </div>
  );
}
