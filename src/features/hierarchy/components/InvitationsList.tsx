// src/features/hierarchy/components/InvitationsList.tsx

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  useSentInvitations,
  useResendInvitation,
  useCancelInvitation,
} from "@/hooks";

export function InvitationsList() {
  const { data: invitationsRaw, isLoading } = useSentInvitations("pending");
  const resendMutation = useResendInvitation();
  const cancelMutation = useCancelInvitation();

  // Filter out stale invitations where invitee already joined hierarchy
  const invitations = useMemo(() => {
    if (!invitationsRaw) return [];
    return invitationsRaw.filter((inv) => {
      // Hide invitations where invitee is already in a hierarchy
      // These are stale and should not be shown - they should be cleaned up
      if (inv.invitee_has_upline) return false;
      // Hide invitations where invitee already has downlines (can't join as downline)
      if (inv.invitee_has_downlines) return false;
      return true;
    });
  }, [invitationsRaw]);

  const handleResendInvitation = async (invitationId: string) => {
    await resendMutation.mutateAsync({ invitation_id: invitationId });
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (confirm("Are you sure you want to cancel this invitation?")) {
      await cancelMutation.mutateAsync({ invitation_id: invitationId });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 border-v2-ring text-v2-ink-muted dark:text-v2-ink-subtle"
          >
            <Clock className="h-2 w-2 mr-0.5" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-600"
          >
            <CheckCircle className="h-2 w-2 mr-0.5" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 text-red-600 dark:text-red-400 border-red-300 dark:border-red-600"
          >
            <XCircle className="h-2 w-2 mr-0.5" />
            Declined
          </Badge>
        );
      case "expired":
        return (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 text-v2-ink-subtle border-v2-ring"
          >
            Expired
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
            Pending Invitations
          </div>
          {invitations && invitations.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle"
            >
              View All
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-[11px] text-v2-ink-muted text-center py-2">
            Loading invitations...
          </div>
        ) : !invitations || invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Send className="h-6 w-6 text-v2-ink-subtle mb-1" />
            <p className="text-[11px] text-v2-ink-muted">
              No pending invitations
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {invitations?.slice(0, 5).map((invitation) => {
              const isStale =
                invitation.can_accept === false && !invitation.is_expired;
              const isExpired = invitation.is_expired || false;
              const isInvalid = isStale || isExpired;

              // Get reason for invalid state
              let invalidReason = "";
              if (invitation.invitee_has_upline) {
                invalidReason = "Invitee already in a hierarchy";
              } else if (invitation.invitee_has_downlines) {
                invalidReason = "Invitee has downlines";
              } else if (isExpired) {
                invalidReason = "Invitation expired";
              }

              return (
                <div
                  key={invitation.id}
                  className={`flex items-center justify-between py-1.5 px-2 rounded transition-colors ${
                    isInvalid
                      ? "bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                      : "hover:bg-v2-canvas"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex-1">
                      <div className="text-[11px] font-medium text-v2-ink">
                        {invitation.invitee_email}
                      </div>
                      <div className="text-[10px] text-v2-ink-muted">
                        Sent {formatDate(invitation.created_at)}
                      </div>
                      {isInvalid && invalidReason && (
                        <div className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {invalidReason}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(invitation.status)}
                      {isStale && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-4 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600"
                        >
                          <AlertTriangle className="h-2 w-2 mr-0.5" />
                          Stale
                        </Badge>
                      )}
                    </div>
                  </div>

                  {invitation.status === "pending" && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResendInvitation(invitation.id)}
                        disabled={resendMutation.isPending || isInvalid}
                        className="h-5 w-5 p-0 text-v2-ink-muted hover:text-v2-ink disabled:opacity-30"
                        title={isInvalid ? invalidReason : "Resend invitation"}
                      >
                        {resendMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        disabled={cancelMutation.isPending || isInvalid}
                        className="h-5 w-5 p-0 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 disabled:opacity-30"
                        title={
                          isInvalid
                            ? "Cannot cancel invalid invitation - delete manually if needed"
                            : "Cancel invitation"
                        }
                      >
                        {cancelMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
