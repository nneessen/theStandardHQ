// src/features/settings/agency-request/components/PendingApprovalsList.tsx
// List of pending agency requests awaiting approval - compact zinc styling

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Building2,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Users,
  Inbox,
} from "lucide-react";
import {
  usePendingAgencyRequests,
  useApproveAgencyRequest,
  useRejectAgencyRequest,
} from "@/hooks/agency-request";
import type { AgencyRequest } from "@/types/agency-request.types";
import { formatAgencyRequestDisplayName } from "@/types/agency-request.types";

export function PendingApprovalsList() {
  const { data: pendingRequests, isLoading } = usePendingAgencyRequests();
  const approveRequest = useApproveAgencyRequest();
  const rejectRequest = useRejectAgencyRequest();

  const [selectedRequest, setSelectedRequest] = useState<AgencyRequest | null>(
    null,
  );
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = (request: AgencyRequest) => {
    setSelectedRequest(request);
    setActionType("approve");
  };

  const handleReject = (request: AgencyRequest) => {
    setSelectedRequest(request);
    setActionType("reject");
    setRejectionReason("");
  };

  const handleConfirmAction = async () => {
    if (!selectedRequest || !actionType) return;

    try {
      if (actionType === "approve") {
        await approveRequest.mutateAsync(selectedRequest.id);
        toast.success("Agency request approved! New agency has been created.");
      } else {
        await rejectRequest.mutateAsync({
          requestId: selectedRequest.id,
          reason: rejectionReason.trim() || undefined,
        });
        toast.success("Agency request rejected");
      }
      setSelectedRequest(null);
      setActionType(null);
      setRejectionReason("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to ${actionType} request`;
      toast.error(message);
    }
  };

  const closeDialog = () => {
    setSelectedRequest(null);
    setActionType(null);
    setRejectionReason("");
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-center text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
          Loading pending requests...
        </div>
      </div>
    );
  }

  if (!pendingRequests || pendingRequests.length === 0) {
    return (
      <div className="border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-[11px] font-semibold text-foreground">
            Pending Approvals
          </h4>
        </div>
        <div className="text-center py-4">
          <Inbox className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">
            No pending requests
          </p>
          <p className="text-[10px] text-muted-foreground">
            When agents in your downline request agency status, they will appear
            here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-3.5 w-3.5 text-warning" />
          <h4 className="text-[11px] font-semibold text-foreground">
            Pending Approvals
          </h4>
          <Badge variant="destructive" className="text-[10px] h-4 px-1">
            {pendingRequests.length}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">
          Review and approve or reject agency requests from your downline
        </p>
        <div className="space-y-2">
          {pendingRequests.map((request) => (
            <PendingRequestCard
              key={request.id}
              request={request}
              onApprove={() => handleApprove(request)}
              onReject={() => handleReject(request)}
              isProcessing={
                (approveRequest.isPending || rejectRequest.isPending) &&
                selectedRequest?.id === request.id
              }
            />
          ))}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={!!selectedRequest && !!actionType}
        onOpenChange={closeDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {actionType === "approve"
                ? "Approve Agency Request"
                : "Reject Agency Request"}
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              {actionType === "approve" ? (
                <>
                  This will create a new agency for{" "}
                  <strong>
                    {selectedRequest?.requester
                      ? formatAgencyRequestDisplayName(
                          selectedRequest.requester.first_name,
                          selectedRequest.requester.last_name,
                          selectedRequest.requester.email,
                        )
                      : "the requester"}
                  </strong>{" "}
                  and move their downline agents to the new agency.
                </>
              ) : (
                "Provide an optional reason for rejection."
              )}
            </DialogDescription>
          </DialogHeader>

          {actionType === "approve" && selectedRequest && (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-medium text-foreground">
                  {selectedRequest.proposed_name}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1 font-mono"
                >
                  {selectedRequest.proposed_code}
                </Badge>
              </div>
              {selectedRequest.proposed_description && (
                <p className="text-[10px] text-muted-foreground">
                  {selectedRequest.proposed_description}
                </p>
              )}
            </div>
          )}

          {actionType === "reject" && (
            <div className="space-y-1.5">
              <Label
                htmlFor="rejection-reason"
                className="text-[11px] text-muted-foreground"
              >
                Rejection Reason (Optional)
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this request is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="text-[11px] resize-none"
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={closeDialog}
              size="sm"
              className="h-7 text-[11px]"
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleConfirmAction}
              disabled={approveRequest.isPending || rejectRequest.isPending}
              size="sm"
              className="h-7 text-[11px]"
            >
              {approveRequest.isPending || rejectRequest.isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Processing...
                </>
              ) : actionType === "approve" ? (
                <>
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Approve
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PendingRequestCardProps {
  request: AgencyRequest;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

function PendingRequestCard({
  request,
  onApprove,
  onReject,
  isProcessing,
}: PendingRequestCardProps) {
  const requesterName = request.requester
    ? formatAgencyRequestDisplayName(
        request.requester.first_name,
        request.requester.last_name,
        request.requester.email,
      )
    : "Unknown";

  return (
    <div className="border border-border rounded-lg p-2.5 space-y-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground">
              {requesterName}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {request.proposed_name}
            </span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono">
              {request.proposed_code}
            </Badge>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {new Date(request.requested_at).toLocaleDateString()}
        </span>
      </div>

      {request.proposed_description && (
        <p className="text-[10px] text-muted-foreground line-clamp-2">
          {request.proposed_description}
        </p>
      )}

      {request.current_agency && (
        <p className="text-[10px] text-muted-foreground">
          Currently in: {request.current_agency.name}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={onApprove}
          disabled={isProcessing}
          className="flex-1 h-6 text-[10px]"
        >
          <CheckCircle className="mr-1 h-3 w-3" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={isProcessing}
          className="flex-1 h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
        >
          <XCircle className="mr-1 h-3 w-3" />
          Reject
        </Button>
      </div>
    </div>
  );
}
