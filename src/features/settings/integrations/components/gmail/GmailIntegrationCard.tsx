// src/features/settings/integrations/components/gmail/GmailIntegrationCard.tsx
// Gmail OAuth integration card for settings page

import { useState } from "react";
import {
  Mail,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useGmailIntegration,
  useConnectGmail,
  useDisconnectGmail,
  useSyncGmail,
} from "@/hooks/gmail";

export function GmailIntegrationCard() {
  const { data: integration, isLoading } = useGmailIntegration();
  const connectGmail = useConnectGmail();
  const disconnectGmail = useDisconnectGmail();
  const syncGmail = useSyncGmail();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const isConnected = integration?.connection_status === "connected";
  const isExpired = integration?.connection_status === "expired";
  const hasError = integration?.connection_status === "error";
  const hasIntegration = !!integration && integration.is_active;

  const handleConnect = async () => {
    try {
      const returnUrl = `${window.location.origin}/settings?tab=integrations`;
      await connectGmail.mutateAsync(returnUrl);
    } catch (err) {
      console.error("[GmailIntegrationCard] Error connecting:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to initiate Gmail connection";
      toast.error(message);
    }
  };

  const handleReconnect = async () => {
    // Same as connect - Google will skip consent if already authorized
    await handleConnect();
  };

  const handleDisconnect = async () => {
    if (!integration?.id) return;

    try {
      await disconnectGmail.mutateAsync(integration.id);
      setShowDisconnectDialog(false);
    } catch {
      toast.error("Failed to disconnect Gmail account");
    }
  };

  const handleSync = async () => {
    if (!integration?.id) return;

    try {
      await syncGmail.mutateAsync(integration.id);
    } catch {
      toast.error("Failed to sync Gmail inbox");
    }
  };

  // Format last synced time
  const formatLastSynced = (date: string | null) => {
    if (!date) return "Never synced";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Card */}
      <div className="bg-v2-card rounded-lg border border-v2-ring p-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 dark:from-red-900/30 dark:to-orange-900/30">
            <Mail className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-v2-ink">Gmail</h3>
              {isConnected ? (
                <Badge
                  variant="default"
                  className="text-[9px] h-4 px-1.5 bg-green-600"
                >
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                  Connected
                </Badge>
              ) : isExpired ? (
                <Badge
                  variant="secondary"
                  className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                >
                  <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                  Expired
                </Badge>
              ) : hasError ? (
                <Badge
                  variant="secondary"
                  className="text-[9px] h-4 px-1.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                >
                  <XCircle className="h-2.5 w-2.5 mr-0.5" />
                  Error
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  <XCircle className="h-2.5 w-2.5 mr-0.5" />
                  Not Connected
                </Badge>
              )}
            </div>

            <p className="text-[10px] text-v2-ink-muted mt-1">
              {hasIntegration
                ? "Send and receive emails from your personal Gmail account."
                : "Connect your Gmail to send and receive emails from your own account."}
            </p>
          </div>

          {/* Connect Button - shown when not connected */}
          {!hasIntegration && (
            <Button
              size="sm"
              className="h-7 px-3 text-[10px]"
              onClick={handleConnect}
              disabled={connectGmail.isPending}
            >
              {connectGmail.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Mail className="h-3 w-3 mr-1" />
              )}
              Connect Gmail
            </Button>
          )}
        </div>
      </div>

      {/* Connected Account Card */}
      {hasIntegration && (
        <div className="bg-v2-card rounded-lg border border-v2-ring p-3 space-y-3">
          <h4 className="text-[11px] font-semibold text-v2-ink">
            Connected Account
          </h4>

          <div className="flex items-center gap-3 p-2.5 bg-v2-canvas rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={integration.gmail_picture_url || undefined}
                alt={integration.gmail_name || integration.gmail_address}
              />
              <AvatarFallback className="bg-gradient-to-br from-red-500 to-orange-500 text-white text-xs">
                {integration.gmail_address?.charAt(0).toUpperCase() || "G"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-v2-ink">
                {integration.gmail_name || integration.gmail_address}
              </p>
              <p className="text-[10px] text-v2-ink-muted truncate">
                {integration.gmail_address}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {/* Sync Button */}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={handleSync}
                disabled={syncGmail.isPending}
                title="Sync inbox now"
              >
                {syncGmail.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>

              {/* Reconnect Button (shown if expired/error) */}
              {(isExpired || hasError) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px]"
                  onClick={handleReconnect}
                  disabled={connectGmail.isPending}
                >
                  {connectGmail.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Reconnect
                </Button>
              )}

              {/* Disconnect Button */}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-v2-ink-subtle hover:text-red-500"
                onClick={() => setShowDisconnectDialog(true)}
                title="Disconnect Gmail"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Sync Status */}
          <div className="flex items-center justify-between text-[10px] text-v2-ink-muted">
            <span>
              Last synced: {formatLastSynced(integration.last_synced_at)}
            </span>
            {integration.last_error && (
              <span
                className="text-red-500 truncate max-w-[200px]"
                title={integration.last_error}
              >
                Error: {integration.last_error}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Token Expiry Warning */}
      {isExpired && (
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Gmail Connection Expired
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                Your Gmail connection has expired. Please reconnect to continue
                sending and receiving emails.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Warning */}
      {hasError && integration?.last_error && (
        <div className="bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 p-3">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-medium text-red-700 dark:text-red-300">
                Connection Error
              </p>
              <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                {integration.last_error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Disconnect Gmail?</DialogTitle>
            <DialogDescription className="text-[11px]">
              This will disconnect your Gmail account. You will no longer be
              able to send or receive emails from {integration?.gmail_address}.
              You can reconnect at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-[11px]"
              onClick={() => setShowDisconnectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="text-[11px]"
              onClick={handleDisconnect}
              disabled={disconnectGmail.isPending}
            >
              {disconnectGmail.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
