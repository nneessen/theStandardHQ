// src/features/settings/agency-request/components/RequestAgencySection.tsx
// Section showing request form or current request status - compact zinc styling

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import {
  useCanRequestAgency,
  useMyAgencyRequests,
} from "@/hooks/agency-request";
import { RequestAgencyForm } from "./RequestAgencyForm";
import { MyAgencyRequestStatus } from "./MyAgencyRequestStatus";

export function RequestAgencySection() {
  const { data: eligibility, isLoading: isCheckingEligibility } =
    useCanRequestAgency();
  const { data: myRequests, isLoading: isLoadingRequests } =
    useMyAgencyRequests();

  const isLoading = isCheckingEligibility || isLoadingRequests;

  if (isLoading) {
    return (
      <div className="border border-v2-ring rounded-lg p-4">
        <div className="flex items-center justify-center text-[11px] text-v2-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
          Loading...
        </div>
      </div>
    );
  }

  // Get the most recent request
  const latestRequest = myRequests?.[0];
  const hasPendingRequest = latestRequest?.status === "pending";
  const hasApprovedRequest = latestRequest?.status === "approved";
  const hasRejectedRequest = latestRequest?.status === "rejected";

  // If user has an approved request, show success
  if (hasApprovedRequest) {
    return (
      <div className="border border-v2-ring rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          <div>
            <h4 className="text-[11px] font-semibold text-green-700 dark:text-green-500">
              Agency Created
            </h4>
            <p className="text-[10px] text-v2-ink-muted">
              Your agency request was approved and your agency has been created.
            </p>
          </div>
        </div>
        <MyAgencyRequestStatus request={latestRequest} />
      </div>
    );
  }

  // If user has a pending request, show status
  if (hasPendingRequest) {
    return (
      <div className="border border-v2-ring rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <div>
            <h4 className="text-[11px] font-semibold text-amber-700 dark:text-amber-500">
              Request Pending
            </h4>
            <p className="text-[10px] text-v2-ink-muted">
              Your agency request is waiting for approval from your upline.
            </p>
          </div>
        </div>
        <MyAgencyRequestStatus request={latestRequest} />
      </div>
    );
  }

  // If user has a rejected request, show rejection with option to re-request
  if (hasRejectedRequest) {
    return (
      <div className="border border-v2-ring rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2">
          <XCircle className="h-3.5 w-3.5 text-red-600" />
          <div>
            <h4 className="text-[11px] font-semibold text-red-700 dark:text-red-500">
              Request Rejected
            </h4>
            <p className="text-[10px] text-v2-ink-muted">
              Your previous request was rejected. You may submit a new request.
            </p>
          </div>
        </div>
        <MyAgencyRequestStatus request={latestRequest} />
        {eligibility?.canRequest && (
          <div className="pt-3 border-t border-v2-ring">
            <h4 className="text-[11px] font-medium text-v2-ink-muted mb-2">
              Submit New Request
            </h4>
            <RequestAgencyForm />
          </div>
        )}
      </div>
    );
  }

  // If user can request, show form
  if (eligibility?.canRequest) {
    return (
      <div className="border border-v2-ring rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-3.5 w-3.5 text-v2-ink-subtle" />
          <div>
            <h4 className="text-[11px] font-semibold text-v2-ink">
              Request Agency Status
            </h4>
            <p className="text-[10px] text-v2-ink-muted">
              Submit a request to become an agency. Your direct upline will
              review and approve.
            </p>
          </div>
        </div>
        <RequestAgencyForm />
      </div>
    );
  }

  // User cannot request - show reason
  return (
    <div className="border border-v2-ring rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-3.5 w-3.5 text-v2-ink-subtle" />
        <h4 className="text-[11px] font-semibold text-v2-ink">Agency Status</h4>
      </div>
      <div className="flex items-start gap-2 p-2 bg-v2-canvas rounded text-[11px]">
        <AlertCircle className="h-3.5 w-3.5 text-v2-ink-subtle mt-0.5 shrink-0" />
        <p className="text-v2-ink-muted dark:text-v2-ink-subtle">
          {eligibility?.reason ||
            "You are not eligible to request agency status at this time."}
        </p>
      </div>
    </div>
  );
}
