// src/features/settings/integrations/components/instagram/InstagramIntegrationCard.tsx
// Instagram integration card — lists EVERY Instagram account connected for the agency
// (WI-6 multi-account) with per-row status + Reconnect/Disconnect, plus a "Connect
// another account" action. Accounts are agency-scoped: any one can be posted from in
// Social Studio, and DMs route to the original (oldest) account.

import { useState } from "react";
import {
  Instagram,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
  Plus,
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
  useInstagramIntegrations,
  useConnectInstagram,
  useDisconnectInstagram,
} from "@/hooks/instagram";
import { useCurrentUserProfile } from "@/hooks/admin";
import type { InstagramIntegration } from "@/types/instagram.types";

export function InstagramIntegrationCard() {
  const { data: integrations = [], isLoading } = useInstagramIntegrations();
  const { data: profile, isLoading: isProfileLoading } =
    useCurrentUserProfile();
  const connectInstagram = useConnectInstagram();
  const disconnectInstagram = useDisconnectInstagram();

  // The account targeted by the (shared) disconnect confirmation dialog.
  const [disconnectTarget, setDisconnectTarget] =
    useState<InstagramIntegration | null>(null);

  const hasAccounts = integrations.length > 0;
  const canConnect = !!profile?.imo_id && !isProfileLoading;

  const handleConnect = async () => {
    if (!canConnect) {
      toast.error("Please wait while your profile loads…");
      return;
    }
    try {
      const returnUrl = `${window.location.origin}/settings?tab=integrations`;
      await connectInstagram.mutateAsync(returnUrl);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to initiate Instagram connection",
      );
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget?.id) return;
    try {
      await disconnectInstagram.mutateAsync(disconnectTarget.id);
      setDisconnectTarget(null);
      toast.success("Instagram account disconnected");
    } catch {
      toast.error("Failed to disconnect Instagram account");
    }
  };

  if (isLoading || isProfileLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header card */}
      <div className="bg-card rounded-lg border border-border p-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-purple-900/30 dark:to-pink-900/30">
            <Instagram className="h-5 w-5 text-info" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Instagram
              </h3>
              {hasAccounts && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  {integrations.length} connected
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {hasAccounts
                ? "Connect multiple Business/Creator accounts to post from any of them in Social Studio. DMs route to your first connected account."
                : "Connect your Instagram Business account to manage DMs, recruiting, and post from Social Studio."}
            </p>
          </div>

          {/* Connect (first account OR another) */}
          <Button
            size="sm"
            className="h-7 px-3 text-[10px] shrink-0"
            onClick={handleConnect}
            disabled={connectInstagram.isPending || !canConnect}
          >
            {connectInstagram.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : hasAccounts ? (
              <Plus className="h-3 w-3 mr-1" />
            ) : (
              <Instagram className="h-3 w-3 mr-1" />
            )}
            {hasAccounts ? "Connect another" : "Connect Instagram"}
          </Button>
        </div>
      </div>

      {/* Connected accounts list */}
      {hasAccounts && (
        <div className="bg-card rounded-lg border border-border p-3 space-y-2">
          <h4 className="text-[11px] font-semibold text-foreground">
            Connected Accounts
          </h4>
          {integrations.map((integration) => {
            const isExpired = integration.connection_status === "expired";
            const hasError = integration.connection_status === "error";
            const isConnected =
              integration.connection_status === "connected" &&
              integration.is_active;
            return (
              <div
                key={integration.id}
                className="flex items-center gap-3 p-2.5 bg-background rounded-lg"
              >
                <Avatar className="h-9 w-9">
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
                  <p className="text-[11px] font-medium text-foreground truncate">
                    {integration.instagram_name ||
                      integration.instagram_username}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    @{integration.instagram_username}
                  </p>
                </div>

                {isConnected ? (
                  <Badge
                    variant="default"
                    className="text-[9px] h-4 px-1.5 bg-success"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                    Connected
                  </Badge>
                ) : isExpired ? (
                  <Badge
                    variant="secondary"
                    className="text-[9px] h-4 px-1.5 bg-warning/20 text-warning dark:bg-warning/50"
                  >
                    <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                    Expired
                  </Badge>
                ) : hasError ? (
                  <Badge
                    variant="secondary"
                    className="text-[9px] h-4 px-1.5 bg-destructive/20 text-destructive dark:bg-destructive/50"
                  >
                    <XCircle className="h-2.5 w-2.5 mr-0.5" />
                    Error
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                    <XCircle className="h-2.5 w-2.5 mr-0.5" />
                    Disconnected
                  </Badge>
                )}

                <div className="flex items-center gap-1">
                  {(isExpired || hasError) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[9px]"
                      onClick={handleConnect}
                      disabled={connectInstagram.isPending || !canConnect}
                      title="Reconnect"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[9px] text-destructive hover:text-destructive"
                    onClick={() => setDisconnectTarget(integration)}
                    disabled={disconnectInstagram.isPending}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disconnect confirmation dialog */}
      <Dialog
        open={!!disconnectTarget}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Instagram className="h-4 w-4 text-info" />
              Disconnect Instagram
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Are you sure you want to disconnect this Instagram account?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={
                    disconnectTarget?.instagram_profile_picture_url || undefined
                  }
                  alt={disconnectTarget?.instagram_username || "Instagram"}
                />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[10px]">
                  {disconnectTarget?.instagram_username
                    ?.charAt(0)
                    .toUpperCase() || "IG"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[11px] font-medium text-foreground">
                  @{disconnectTarget?.instagram_username}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {disconnectTarget?.instagram_name}
                </p>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-[10px] text-warning">
                This stops Instagram DM and Social Studio posting for this
                account. Conversation history is preserved, but you won't be
                able to send/receive or post from it until you reconnect.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisconnectTarget(null)}
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
