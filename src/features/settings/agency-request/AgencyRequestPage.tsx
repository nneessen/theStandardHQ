// src/features/settings/agency-request/AgencyRequestPage.tsx
// Main page for agency request workflow - compact zinc styling

import { Building2 } from "lucide-react";
import { usePendingAgencyRequestCount } from "@/hooks/agency-request";
import { RequestAgencySection } from "./components/RequestAgencySection";
import { PendingApprovalsList } from "./components/PendingApprovalsList";

export function AgencyRequestPage() {
  const { data: pendingCount = 0 } = usePendingAgencyRequestCount();

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-v2-ring/60">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-v2-ink-subtle" />
          <div>
            <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
              Agency Requests
            </h3>
            <p className="text-[10px] text-v2-ink-muted">
              Request to become an agency or manage pending approvals
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Show pending approvals if user has any to approve */}
        {pendingCount > 0 && <PendingApprovalsList />}

        {/* Show request section */}
        <RequestAgencySection />
      </div>
    </div>
  );
}
