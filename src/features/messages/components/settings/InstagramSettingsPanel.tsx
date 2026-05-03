// src/features/messages/components/settings/InstagramSettingsPanel.tsx
// Instagram messaging settings - connection status and account info

import { useState } from "react";
import {
  Loader2,
  Instagram,
  Check,
  AlertCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { NotConnectedState } from "./NotConnectedState";

export function InstagramSettingsPanel() {
  const { data: integration, isLoading } = useActiveInstagramIntegration();
  const connectInstagram = useConnectInstagram();
  const disconnectInstagram = useDisconnectInstagram();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const handleReconnect = async () => {
    try {
      const returnUrl = `${window.location.origin}/messages?tab=settings`;
      await connectInstagram.mutateAsync(returnUrl);
    } catch (err) {
      console.error("[InstagramSettingsPanel] Reconnect failed:", err);
      toast.error("Failed to initiate Instagram connection");
    }
  };

  const handleDisconnect = async () => {
    if (!integration?.id) {
      toast.error("No integration found to disconnect");
      return;
    }

    try {
      await disconnectInstagram.mutateAsync(integration.id);
      setShowDisconnectDialog(false);
      toast.success("Instagram account disconnected");
    } catch (err) {
      console.error("[InstagramSettingsPanel] Disconnect failed:", err);
      toast.error("Failed to disconnect Instagram account");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = integration?.connection_status === "connected";
  const isExpired = integration?.connection_status === "expired";
  const hasError = integration?.connection_status === "error";

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Connection Status */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Instagram className="h-4 w-4 text-muted-foreground" />
            Instagram Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!integration ? (
            <NotConnectedState
              icon={Instagram}
              platform="Instagram"
              onConnect={() => {
                window.location.href = "/settings?tab=integrations";
              }}
            />
          ) : (
            <div className="space-y-4">
              {/* Account Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
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
                <div className="flex-1">
                  <p className="text-[11px] font-medium text-foreground">
                    {integration.instagram_name ||
                      integration.instagram_username}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    @{integration.instagram_username}
                  </p>
                </div>
                {isConnected && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 bg-success/10 dark:bg-success/10 text-success border-success/30"
                  >
                    <Check className="h-2.5 w-2.5 mr-1" />
                    Connected
                  </Badge>
                )}
                {isExpired && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 bg-warning/10 text-warning border-warning/30"
                  >
                    <AlertCircle className="h-2.5 w-2.5 mr-1" />
                    Expired
                  </Badge>
                )}
                {hasError && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 bg-destructive/10 text-destructive border-destructive/30"
                  >
                    <AlertCircle className="h-2.5 w-2.5 mr-1" />
                    Error
                  </Badge>
                )}
                {/* Disconnect Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/10"
                  onClick={() => setShowDisconnectDialog(true)}
                  disabled={disconnectInstagram.isPending}
                >
                  Disconnect
                </Button>
              </div>

              {/* Reconnect if needed */}
              {(isExpired || hasError) && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <p className="text-[11px] text-warning mb-2">
                    {isExpired
                      ? "Your Instagram connection has expired. Please reconnect to continue messaging."
                      : "There was an error with your Instagram connection. Please try reconnecting."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={handleReconnect}
                    disabled={connectInstagram.isPending}
                  >
                    {connectInstagram.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                    )}
                    Reconnect Instagram
                  </Button>
                </div>
              )}

              {/* Info Note */}
              {isConnected && (
                <p className="text-[10px] text-muted-foreground">
                  Manage templates in the Templates tab.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Instagram className="h-4 w-4 text-info" />
              Disconnect Instagram
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Are you sure you want to disconnect your Instagram account?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
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
                <p className="text-[11px] font-medium text-foreground">
                  @{integration?.instagram_username}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {integration?.instagram_name}
                </p>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-[10px] text-warning">
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
