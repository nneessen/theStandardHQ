// src/features/settings/agency-request/components/MyAgencyRequestStatus.tsx
// Shows the status of a user's agency request - compact zinc styling

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, XCircle, Clock, CheckCircle2, Building2 } from "lucide-react";
import { useCancelAgencyRequest } from "@/hooks/agency-request";
import type { AgencyRequest } from "@/types/agency-request.types";
import { formatAgencyRequestDisplayName } from "@/types/agency-request.types";

interface MyAgencyRequestStatusProps {
  request: AgencyRequest;
}

export function MyAgencyRequestStatus({ request }: MyAgencyRequestStatusProps) {
  const cancelRequest = useCancelAgencyRequest();

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this request?")) {
      return;
    }

    try {
      await cancelRequest.mutateAsync(request.id);
      toast.success("Request cancelled");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to cancel request";
      toast.error(message);
    }
  };

  const getStatusBadge = () => {
    switch (request.status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
          >
            <Clock className="mr-0.5 h-2.5 w-2.5" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
          >
            <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
          >
            <XCircle className="mr-0.5 h-2.5 w-2.5" />
            Rejected
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1 bg-v2-canvas text-v2-ink-muted border-v2-ring dark:bg-v2-card-tinted dark:text-v2-ink-subtle dark:border-v2-ring-strong"
          >
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            {request.status}
          </Badge>
        );
    }
  };

  const approverName = request.approver
    ? formatAgencyRequestDisplayName(
        request.approver.first_name,
        request.approver.last_name,
        request.approver.email,
      )
    : "Unknown";

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-3 w-3 text-v2-ink-subtle" />
          <span className="text-[11px] font-medium text-v2-ink">
            {request.proposed_name}
          </span>
          <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono">
            {request.proposed_code}
          </Badge>
        </div>
        {getStatusBadge()}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
        <div>
          <span className="text-v2-ink-subtle">Submitted:</span>
          <span className="ml-1 text-v2-ink-muted">
            {new Date(request.requested_at).toLocaleDateString()}
          </span>
        </div>
        <div>
          <span className="text-v2-ink-subtle">Approver:</span>
          <span className="ml-1 text-v2-ink-muted">{approverName}</span>
        </div>
        {request.reviewed_at && (
          <div>
            <span className="text-v2-ink-subtle">Reviewed:</span>
            <span className="ml-1 text-v2-ink-muted">
              {new Date(request.reviewed_at).toLocaleDateString()}
            </span>
          </div>
        )}
        {request.created_agency && (
          <div>
            <span className="text-v2-ink-subtle">Agency:</span>
            <span className="ml-1 text-v2-ink-muted">
              {request.created_agency.name}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {request.proposed_description && (
        <div className="text-[10px]">
          <span className="text-v2-ink-subtle">Description:</span>
          <p className="mt-0.5 text-v2-ink-muted dark:text-v2-ink-subtle">
            {request.proposed_description}
          </p>
        </div>
      )}

      {/* Rejection reason */}
      {request.status === "rejected" && request.rejection_reason && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-[10px]">
          <span className="text-red-700 dark:text-red-400 font-medium">
            Rejection Reason:
          </span>
          <p className="text-red-600 dark:text-red-300 mt-0.5">
            {request.rejection_reason}
          </p>
        </div>
      )}

      {/* Cancel button */}
      {request.status === "pending" && (
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={cancelRequest.isPending}
            className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            {cancelRequest.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Cancelling...
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Cancel Request
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
