import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Loader2,
  Building2,
  Users,
  User,
} from "lucide-react";
import {
  useMyPendingJoinRequest,
  useMyJoinRequests,
  useCancelJoinRequest,
} from "@/hooks/join-request";
import type { JoinRequest } from "@/types/join-request.types";

const statusConfig = {
  pending: {
    icon: Clock,
    label: "Pending",
    variant: "outline" as const,
    color: "text-amber-600 dark:text-amber-400",
  },
  approved: {
    icon: CheckCircle2,
    label: "Approved",
    variant: "default" as const,
    color: "text-green-600 dark:text-green-400",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    variant: "destructive" as const,
    color: "text-red-600 dark:text-red-400",
  },
  cancelled: {
    icon: Ban,
    label: "Cancelled",
    variant: "secondary" as const,
    color: "text-v2-ink-muted",
  },
};

function formatUserName(user?: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}) {
  if (!user) return "Unknown";
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return name || user.email || "Unknown";
}

function RequestCard({ request }: { request: JoinRequest }) {
  const cancelRequest = useCancelJoinRequest();
  const config = statusConfig[request.status as keyof typeof statusConfig];
  const StatusIcon = config.icon;

  const handleCancel = async () => {
    try {
      await cancelRequest.mutateAsync(request.id);
      toast.success("Request cancelled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel request",
      );
    }
  };

  return (
    <div className="border border-v2-ring rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
          <span className="text-[11px] font-semibold text-v2-ink">
            Join Request
          </span>
        </div>
        <Badge variant={config.variant} className="text-[10px] h-5 px-1.5">
          {config.label}
        </Badge>
      </div>

      <div className="space-y-2">
        {/* IMO */}
        <div className="flex items-center gap-2 text-[11px]">
          <Building2 className="h-3 w-3 text-v2-ink-subtle" />
          <span className="text-v2-ink-muted">IMO:</span>
          <span className="font-medium text-v2-ink">
            {request.imo?.name || "Unknown"}
          </span>
        </div>

        {/* Agency */}
        {request.agency && (
          <div className="flex items-center gap-2 text-[11px]">
            <Users className="h-3 w-3 text-v2-ink-subtle" />
            <span className="text-v2-ink-muted">Agency:</span>
            <span className="font-medium text-v2-ink">
              {request.agency.name}
            </span>
          </div>
        )}

        {/* Approver */}
        <div className="flex items-center gap-2 text-[11px]">
          <User className="h-3 w-3 text-v2-ink-subtle" />
          <span className="text-v2-ink-muted">Reviewed by:</span>
          <span className="font-medium text-v2-ink">
            {formatUserName(request.approver)}
          </span>
        </div>

        {/* Message */}
        {request.message && (
          <div className="text-[10px] text-v2-ink-muted bg-v2-canvas p-2 rounded">
            "{request.message}"
          </div>
        )}

        {/* Rejection Reason */}
        {request.status === "rejected" && request.rejection_reason && (
          <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-800">
            <span className="font-medium">Reason:</span>{" "}
            {request.rejection_reason}
          </div>
        )}

        {/* Timestamps */}
        <div className="text-[10px] text-v2-ink-subtle">
          Requested: {new Date(request.requested_at).toLocaleDateString()}
          {request.reviewed_at && (
            <>
              {" "}
              · Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}
            </>
          )}
        </div>

        {/* Cancel Button */}
        {request.status === "pending" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={cancelRequest.isPending}
            className="w-full h-6 text-[10px] mt-2"
          >
            {cancelRequest.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Ban className="h-3 w-3 mr-1" />
            )}
            Cancel Request
          </Button>
        )}
      </div>
    </div>
  );
}

export function MyJoinRequestStatus() {
  const { data: pendingRequest, isLoading: pendingLoading } =
    useMyPendingJoinRequest();
  const { data: allRequests, isLoading: allLoading } = useMyJoinRequests();

  if (pendingLoading || allLoading) {
    return (
      <div className="border border-v2-ring rounded-lg p-4">
        <div className="flex items-center justify-center text-[11px] text-v2-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
          Loading...
        </div>
      </div>
    );
  }

  // Show pending request prominently
  if (pendingRequest) {
    return <RequestCard request={pendingRequest} />;
  }

  // Show most recent non-pending request if any
  const recentRequest = allRequests?.find((r) => r.status !== "pending");
  if (recentRequest) {
    return <RequestCard request={recentRequest} />;
  }

  // No requests
  return null;
}
