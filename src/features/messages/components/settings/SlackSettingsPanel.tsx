// src/features/messages/components/settings/SlackSettingsPanel.tsx
// Slack messaging settings - auto-post and workspace preferences

import { Loader2, MessageSquare, Check, Zap } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { useSlackIntegrations, useSlackChannelsById } from "@/hooks/slack";
import {
  useUserSlackPreferences,
  useToggleAutoPost,
  useSetDefaultSlackChannel,
} from "@/hooks";
import type { SlackChannel } from "@/types/slack.types";
import { NotConnectedState } from "./NotConnectedState";

export function SlackSettingsPanel() {
  const { data: integrations, isLoading: integrationsLoading } =
    useSlackIntegrations();
  const { data: userPrefs, isLoading: prefsLoading } =
    useUserSlackPreferences();
  const toggleAutoPost = useToggleAutoPost();
  const setDefaultChannel = useSetDefaultSlackChannel();

  // Get the first connected integration for channel list
  const connectedIntegrations =
    integrations?.filter((i) => i.isConnected) ?? [];
  const defaultIntegration = connectedIntegrations[0];

  // Get channels for the default integration
  const { data: channels } = useSlackChannelsById(defaultIntegration?.id);

  const isLoading = integrationsLoading || prefsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  const hasConnectedWorkspaces = connectedIntegrations.length > 0;

  const handleToggleAutoPost = async (enabled: boolean) => {
    try {
      await toggleAutoPost.mutateAsync(enabled);
      toast.success(enabled ? "Auto-post enabled" : "Auto-post disabled");
    } catch {
      toast.error("Failed to update auto-post setting");
    }
  };

  const handleSetDefaultChannel = async (channelId: string) => {
    if (!defaultIntegration) return;

    const channel = channels?.find((c: SlackChannel) => c.id === channelId);
    try {
      await setDefaultChannel.mutateAsync({
        integrationId: defaultIntegration.id,
        channelId: channelId || null,
        channelName: channel?.name || null,
      });
      toast.success("Default channel updated");
    } catch {
      toast.error("Failed to update default channel");
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Connection Status */}
      <Card className="border-v2-ring">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-v2-ink-muted" />
            Connected Workspaces
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasConnectedWorkspaces ? (
            <NotConnectedState icon={MessageSquare} platform="Slack" />
          ) : (
            <div className="space-y-2">
              {connectedIntegrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-v2-ring"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-v2-ring flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-v2-ink-muted" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-v2-ink">
                        {integration.team_name || "Slack Workspace"}
                      </p>
                      <p className="text-[10px] text-v2-ink-muted">
                        {integration.team_id}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                  >
                    <Check className="h-2.5 w-2.5 mr-1" />
                    Connected
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Post Settings */}
      {hasConnectedWorkspaces && (
        <Card className="border-v2-ring">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-v2-ink-muted" />
              Auto-Post Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auto-post toggle */}
            <div className="flex items-center justify-between rounded-lg border border-v2-ring p-3">
              <div>
                <Label className="text-[11px] font-medium">
                  Auto-post Policy Sales
                </Label>
                <p className="text-[10px] text-v2-ink-muted">
                  Automatically post new policies to Slack
                </p>
              </div>
              <Switch
                checked={userPrefs?.auto_post_enabled ?? false}
                onCheckedChange={handleToggleAutoPost}
                disabled={toggleAutoPost.isPending}
              />
            </div>

            {/* Default Channel */}
            <div className="space-y-2">
              <Label className="text-[11px]">Default View Channel</Label>
              <Select
                value={userPrefs?.default_view_channel_id ?? "__none__"}
                onValueChange={(value) =>
                  handleSetDefaultChannel(value === "__none__" ? "" : value)
                }
                disabled={setDefaultChannel.isPending}
              >
                <SelectTrigger className="h-8 text-[11px]">
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-[11px]">
                    None
                  </SelectItem>
                  {channels?.map((channel: SlackChannel) => (
                    <SelectItem
                      key={channel.id}
                      value={channel.id}
                      className="text-[11px]"
                    >
                      #{channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-v2-ink-muted">
                The channel shown by default in the Messages → Slack tab
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
