// src/features/settings/integrations/components/instagram/InstagramIntegrationCard.tsx
// Instagram DM integration card for settings page

import { useState } from "react";
import {
  Instagram,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
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
  useActiveInstagramIntegration,
  useConnectInstagram,
  useDisconnectInstagram,
} from "@/hooks/instagram";
import { useCurrentUserProfile } from "@/hooks/admin";

export function InstagramIntegrationCard() {
  const { data: integration, isLoading } = useActiveInstagramIntegration();
  const { data: profile, isLoading: isProfileLoading } =
    useCurrentUserProfile();
  const connectInstagram = useConnectInstagram();
  const disconnectInstagram = useDisconnectInstagram();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const isConnected = integration?.connection_status === "connected";
  const isExpired = integration?.connection_status === "expired";
  const hasError = integration?.connection_status === "error";
  const hasIntegration = !!integration;

  // Check if we're ready to connect (profile must be loaded with imo_id)
  const canConnect = !!profile?.imo_id && !isProfileLoading;

  const handleConnect = async () => {
    console.log("[InstagramIntegrationCard] handleConnect called", {
      canConnect,
      profileImoId: profile?.imo_id,
      isProfileLoading,
    });

    if (!canConnect) {
      toast.error("Please wait while your profile loads...");
      return;
    }
    try {
      const returnUrl = `${window.location.origin}/settings?tab=integrations`;
      console.log(
        "[InstagramIntegrationCard] Calling mutateAsync with returnUrl:",
        returnUrl,
      );
      await connectInstagram.mutateAsync(returnUrl);
      console.log(
        "[InstagramIntegrationCard] mutateAsync completed (should have redirected)",
      );
    } catch (err) {
      console.error("[InstagramIntegrationCard] Error in handleConnect:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to initiate Instagram connection";
      toast.error(message);
    }
  };

  const handleDisconnect = async () => {
    if (!integration?.id) return;

    try {
      await disconnectInstagram.mutateAsync(integration.id);
      setShowDisconnectDialog(false);
      toast.success("Instagram account disconnected");
    } catch {
      toast.error("Failed to disconnect Instagram account");
    }
  };

  if (isLoading || isProfileLoading) {
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
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-purple-900/30 dark:to-pink-900/30">
            <Instagram className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-v2-ink">
                Instagram DM
              </h3>
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
                ? "Manage Instagram DM conversations and recruiting leads."
                : "Connect your Instagram Business account to manage DMs and recruiting."}
            </p>
          </div>

          {/* Connect Button - shown when not connected */}
          {!hasIntegration && (
            <Button
              size="sm"
              className="h-7 px-3 text-[10px]"
              onClick={handleConnect}
              disabled={connectInstagram.isPending || !canConnect}
            >
              {connectInstagram.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Instagram className="h-3 w-3 mr-1" />
              )}
              Connect Instagram
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
                src={integration.instagram_profile_picture_url || undefined}
                alt={integration.instagram_username || "Instagram"}
              />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                {integration.instagram_username?.charAt(0).toUpperCase() ||
                  "IG"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-v2-ink">
                {integration.instagram_name || integration.instagram_username}
              </p>
              <p className="text-[10px] text-v2-ink-muted">
                @{integration.instagram_username}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Reconnect button if expired or error */}
              {(isExpired || hasError) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[9px]"
                  onClick={handleConnect}
                  disabled={connectInstagram.isPending || !canConnect}
                >
                  {connectInstagram.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Reconnect
                </Button>
              )}

              {/* Disconnect button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[9px] text-red-500 hover:text-red-600 dark:text-red-400"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={disconnectInstagram.isPending}
              >
                Disconnect
              </Button>
            </div>
          </div>

          {/* Warning message for expired/error state */}
          {(isExpired || hasError) && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] text-amber-800 dark:text-amber-200">
                {isExpired
                  ? "Your Instagram connection has expired. Please reconnect to continue using Instagram DM features."
                  : "There was an error with your Instagram connection. Please try reconnecting."}
              </p>
            </div>
          )}

          {/* Info note for connected state */}
          {isConnected && (
            <p className="text-[9px] text-v2-ink-subtle">
              Access Instagram DMs from the Messages page. Templates can be
              managed in Messages → Settings → Templates.
            </p>
          )}
        </div>
      )}

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Instagram className="h-4 w-4 text-purple-500" />
              Disconnect Instagram
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Are you sure you want to disconnect your Instagram account?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <div className="flex items-center gap-3 p-3 bg-v2-canvas rounded-lg">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={integration?.instagram_profile_picture_url || undefined}
                  alt={integration?.instagram_username || "Instagram"}
                />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[10px]">
                  {integration?.instagram_username?.charAt(0).toUpperCase() ||
                    "IG"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[11px] font-medium text-v2-ink">
                  @{integration?.instagram_username}
                </p>
                <p className="text-[10px] text-v2-ink-muted">
                  {integration?.instagram_name}
                </p>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] text-amber-800 dark:text-amber-200">
                This will stop all Instagram DM features. Your conversation
                history will be preserved, but you won't be able to send or
                receive messages until you reconnect.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisconnectDialog(false)}
              className="h-7 text-[10px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnectInstagram.isPending}
              className="h-7 text-[10px]"
            >
              {disconnectInstagram.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
