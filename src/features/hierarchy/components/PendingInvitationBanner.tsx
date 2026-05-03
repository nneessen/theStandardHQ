// src/features/hierarchy/components/PendingInvitationBanner.tsx
// Banner to display pending invitations received by the user

import { useState } from "react";
import {
  useReceivedInvitations,
  useAcceptInvitation,
  useDenyInvitation,
} from "../../../hooks/hierarchy/useInvitations";
import { Button } from "../../../components/ui/button";
import { AlertCircle, Check, X, Mail, Clock, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";

export function PendingInvitationBanner() {
  const { data: receivedInvitations, isLoading } =
    useReceivedInvitations("pending");
  const acceptMutation = useAcceptInvitation();
  const denyMutation = useDenyInvitation();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if loading, no invitations, or dismissed
  if (
    isLoading ||
    !receivedInvitations ||
    receivedInvitations.length === 0 ||
    dismissed
  ) {
    return null;
  }

  // Show only the first pending invitation (since we enforce one at a time)
  const invitation = receivedInvitations[0];

  const handleAccept = async () => {
    if (!invitation.can_accept) {
      return; // Should not happen due to UI disabling, but extra safety
    }
    await acceptMutation.mutateAsync({ invitation_id: invitation.id });
  };

  const handleDeny = async () => {
    await denyMutation.mutateAsync({ invitation_id: invitation.id });
  };

  const isExpired = invitation.is_expired || false;
  const canAccept = invitation.can_accept || false;

  return (
    <Alert className="bg-gradient-to-r from-blue-50 to-cyan-50 border-info/30">
      <Mail className="h-5 w-5 text-info" />
      <AlertTitle className="flex items-center justify-between">
        <span className="font-semibold text-info">
          Hierarchy Invitation Received
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="space-y-3 mt-2">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {invitation.inviter_email || "Unknown"}
              </span>
              <span className="text-muted-foreground">
                invited you to join their downline
              </span>
            </div>

            {invitation.message && (
              <div className="text-sm bg-white/60 rounded px-3 py-2 border border-info/20">
                <p className="text-muted-foreground italic">
                  "{invitation.message}"
                </p>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Sent{" "}
                  {formatDistanceToNow(new Date(invitation.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isExpired ? (
                  <span className="text-destructive font-medium">Expired</span>
                ) : (
                  <span>
                    Expires{" "}
                    {formatDistanceToNow(new Date(invitation.expires_at), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* Warnings if cannot accept */}
            {!canAccept && !isExpired && (
              <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 rounded px-3 py-2 border border-warning/30">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  {invitation.invitee_has_upline && (
                    <p>You are already in a hierarchy</p>
                  )}
                  {invitation.invitee_has_downlines && (
                    <p>
                      You have existing downlines (must have zero downlines to
                      accept)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={
                !canAccept ||
                isExpired ||
                acceptMutation.isPending ||
                denyMutation.isPending
              }
              className="bg-success hover:bg-success"
            >
              <Check className="h-4 w-4 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeny}
              disabled={
                isExpired || acceptMutation.isPending || denyMutation.isPending
              }
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4 mr-1" />
              Deny
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
