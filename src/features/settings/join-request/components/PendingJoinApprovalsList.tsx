import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  Building2,
  User,
  Clock,
  MessageSquare,
} from "lucide-react";
import {
  usePendingJoinApprovals,
  useApproveJoinRequest,
  useRejectJoinRequest,
} from "@/hooks/join-request";
import type { JoinRequest } from "@/types/join-request.types";

function formatUserName(user?: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}) {
  if (!user) return "Unknown";
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return name || user.email || "Unknown";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface RequestRowProps {
  request: JoinRequest;
  onApprove: (request: JoinRequest) => void;
  onReject: (request: JoinRequest) => void;
}

function RequestRow({ request, onApprove, onReject }: RequestRowProps) {
  return (
    <div className="border border-border rounded-lg p-2.5 space-y-2 hover:bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-[11px] text-foreground">
            {formatUserName(request.requester)}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
          <Clock className="h-2.5 w-2.5 mr-1" />
          {formatDate(request.requested_at)}
        </Badge>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          <span>{request.imo?.name || "Unknown IMO"}</span>
        </div>
        {request.agency && (
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{request.agency.name}</span>
          </div>
        )}
      </div>

      {/* Message */}
      {request.message && (
        <div className="flex items-start gap-1 text-[10px] bg-background p-2 rounded">
          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
          <span className="italic text-muted-foreground">
            "{request.message}"
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="default"
          className="flex-1 h-6 text-[10px]"
          onClick={() => onApprove(request)}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-6 text-[10px]"
          onClick={() => onReject(request)}
        >
          <XCircle className="h-3 w-3 mr-1" />
          Reject
        </Button>
      </div>
    </div>
  );
}

export function PendingJoinApprovalsList() {
  const { data: requests, isLoading } = usePendingJoinApprovals();
  const approveRequest = useApproveJoinRequest();
  const rejectRequest = useRejectJoinRequest();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = async (request: JoinRequest) => {
    try {
      await approveRequest.mutateAsync({ request_id: request.id });
      toast.success(`Approved ${formatUserName(request.requester)}'s request`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve request",
      );
    }
  };

  const handleRejectClick = (request: JoinRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest) return;

    try {
      await rejectRequest.mutateAsync({
        request_id: selectedRequest.id,
        reason: rejectionReason.trim() || null,
      });
      toast.success(
        `Rejected ${formatUserName(selectedRequest.requester)}'s request`,
      );
      setRejectDialogOpen(false);
      setSelectedRequest(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject request",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-center text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
          Loading pending approvals...
        </div>
      </div>
    );
  }

  if (!requests?.length) {
    return (
      <div className="border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">
            Pending Join Requests
          </span>
        </div>
        <p className="text-center text-[11px] text-muted-foreground py-2">
          No pending requests to review
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex-1">
            <span className="text-[11px] font-semibold text-foreground">
              Pending Join Requests
            </span>
            <p className="text-[10px] text-muted-foreground">
              Review and approve new user requests
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {requests.length}
          </Badge>
        </div>

        <div className="space-y-2">
          {requests.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              onApprove={handleApprove}
              onReject={handleRejectClick}
            />
          ))}
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Join Request</DialogTitle>
            <DialogDescription>
              Reject {formatUserName(selectedRequest?.requester)}'s request to
              join. Optionally provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectRequest.isPending}
            >
              {rejectRequest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
