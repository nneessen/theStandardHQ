// src/features/settings/integrations/components/slack/SlackIntegrationCard.tsx
// Multi-workspace Slack integration UI

import { useState, useMemo, useEffect } from "react";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Hash,
  Plus,
  Building2,
  Link2,
  Trash2,
  ExternalLink,
  Key,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSlackIntegrations,
  useConnectSlack,
  useReauthorizeSlackIntegration,
  useDisconnectSlackById,
  useDeleteSlackIntegration,
  useToggleSlackIntegrationActive,
  useTestSlackConnectionById,
  useSlackChannelsById,
  useUpdateSlackIntegrationSettings,
  useJoinSlackChannelById,
  useUserSlackPreferences,
  useUpdateUserSlackPreferences,
  useSlackWebhooks,
  useAddSlackWebhook,
  useUpdateSlackWebhook,
  useDeleteSlackWebhook,
} from "@/hooks/slack";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { useImo } from "@/contexts/ImoContext";
import { useAuth } from "@/contexts/AuthContext";
import type {
  SlackIntegration,
  SlackChannel,
  PolicyPostChannel,
  SlackWebhook,
} from "@/types/slack.types";
import { WorkspaceLogoUpload } from "./WorkspaceLogoUpload";

// ============================================================================
// Sub-component: Single Workspace Card
// ============================================================================

interface WorkspaceCardProps {
  integration: SlackIntegration;
  userPrefs: {
    policy_post_channels: PolicyPostChannel[] | null;
    auto_post_enabled: boolean | null;
    default_view_channel_id: string | null;
    default_view_channel_name: string | null;
    default_view_integration_id: string | null;
  } | null;
  onUpdateUserPrefs: (input: {
    policyPostChannels?: PolicyPostChannel[];
    autoPostEnabled?: boolean;
    defaultViewChannelId?: string | null;
    defaultViewChannelName?: string | null;
    defaultViewIntegrationId?: string | null;
  }) => Promise<void>;
  isUpdatingUserPrefs: boolean;
  isAdmin: boolean;
}

function WorkspaceCard({
  integration,
  userPrefs,
  onUpdateUserPrefs,
  isUpdatingUserPrefs,
  isAdmin,
}: WorkspaceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: channels = [], isLoading: channelsLoading } =
    useSlackChannelsById(isExpanded ? integration.id : undefined);

  const disconnectSlack = useDisconnectSlackById();
  const deleteSlack = useDeleteSlackIntegration();
  const reauthorize = useReauthorizeSlackIntegration();
  const testConnection = useTestSlackConnectionById();
  const updateSettings = useUpdateSlackIntegrationSettings();
  const joinChannel = useJoinSlackChannelById();
  const toggleActive = useToggleSlackIntegrationActive();

  const handleToggleActive = async (active: boolean) => {
    if (!active) {
      if (
        !confirm(
          "Turn off notifications for this workspace? No policy sales or leaderboards will be posted until re-enabled.",
        )
      ) {
        return;
      }
    }
    try {
      await toggleActive.mutateAsync({
        integrationId: integration.id,
        active,
      });
      toast.success(
        active
          ? `Notifications enabled for ${integration.team_name}`
          : `Notifications disabled for ${integration.team_name}`,
      );
    } catch {
      toast.error("Failed to update workspace status");
    }
  };

  // Filter to only show channels the bot is a member of
  const availableChannels = useMemo(() => {
    return channels.filter((c: SlackChannel) => c.is_member && !c.is_archived);
  }, [channels]);

  const handleDisconnect = async () => {
    if (
      !confirm(
        `Are you sure you want to disconnect "${integration.display_name || integration.team_name}"? This will stop notifications to this workspace.`,
      )
    ) {
      return;
    }
    try {
      await disconnectSlack.mutateAsync(integration.id);
      toast.success(`Disconnected from ${integration.team_name}`);
    } catch {
      toast.error("Failed to disconnect workspace");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to PERMANENTLY DELETE "${integration.display_name || integration.team_name}"?\n\nThis will:\n• Remove all channel configurations\n• Delete all message history\n• This action cannot be undone!`,
      )
    ) {
      return;
    }
    try {
      await deleteSlack.mutateAsync(integration.id);
      toast.success(`Deleted workspace ${integration.team_name}`);
    } catch {
      toast.error("Failed to delete workspace");
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnection.mutateAsync(integration.id);
      if (result.ok) {
        toast.success(`${integration.team_name} connection is working`);
      } else {
        toast.error(`Connection test failed: ${result.error}`);
      }
    } catch {
      toast.error("Failed to test connection");
    }
  };

  const handleReauthorize = async () => {
    try {
      await reauthorize.mutateAsync({
        integrationId: integration.id,
        returnUrl: `${window.location.origin}/settings/integrations`,
      });
    } catch {
      toast.error("Failed to initiate re-authorization");
    }
  };

  const handleChannelSelect = async (
    type: "policy" | "leaderboard",
    channelId: string,
  ) => {
    const channel = channels.find((c: SlackChannel) => c.id === channelId);
    if (!channel) return;

    // If bot is not a member, try to join first
    if (!channel.is_member) {
      try {
        const result = await joinChannel.mutateAsync({
          integrationId: integration.id,
          channelId,
        });
        if (!result.ok) {
          toast.error(`Cannot join channel: ${result.error}`);
          return;
        }
      } catch {
        toast.error("Failed to join channel");
        return;
      }
    }

    try {
      if (type === "policy") {
        await updateSettings.mutateAsync({
          integrationId: integration.id,
          settings: {
            policy_channel_id: channelId,
            policy_channel_name: channel.name,
          },
        });
        toast.success(`Policy notifications will go to #${channel.name}`);
      } else {
        await updateSettings.mutateAsync({
          integrationId: integration.id,
          settings: {
            leaderboard_channel_id: channelId,
            leaderboard_channel_name: channel.name,
          },
        });
        toast.success(`Leaderboard will go to #${channel.name}`);
      }
    } catch {
      toast.error("Failed to update channel setting");
    }
  };

  const handleToggleSetting = async (
    setting: "include_client_info" | "include_leaderboard_with_policy",
    value: boolean,
  ) => {
    try {
      await updateSettings.mutateAsync({
        integrationId: integration.id,
        settings: { [setting]: value },
      });
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const handleToggleAdditionalChannel = async (
    channelId: string,
    channelName: string,
    isSelected: boolean,
  ) => {
    const currentChannels = userPrefs?.policy_post_channels ?? [];

    let newChannels: PolicyPostChannel[];
    if (isSelected) {
      newChannels = [
        ...currentChannels,
        {
          integration_id: integration.id,
          channel_id: channelId,
          channel_name: channelName,
        },
      ];
    } else {
      newChannels = currentChannels.filter(
        (c) =>
          !(c.integration_id === integration.id && c.channel_id === channelId),
      );
    }

    try {
      await onUpdateUserPrefs({ policyPostChannels: newChannels });
    } catch {
      toast.error("Failed to update channel preferences");
    }
  };

  const handleSetDefaultViewChannel = async (channelId: string) => {
    const channel = channels.find((c: SlackChannel) => c.id === channelId);
    try {
      await onUpdateUserPrefs({
        defaultViewIntegrationId: integration.id,
        defaultViewChannelId: channelId,
        defaultViewChannelName: channel?.name || null,
      });
      toast.success(
        channel
          ? `Default channel set to #${channel.name}`
          : "Default channel cleared",
      );
    } catch {
      toast.error("Failed to update default channel");
    }
  };

  const isConnected = integration.isConnected;
  const isActive = integration.is_active;

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        !isActive
          ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10"
          : "border-v2-ring"
      }`}
    >
      {/* Workspace Header */}
      <div
        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-v2-canvas ${
          isExpanded ? "border-b border-v2-ring" : ""
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand Icon */}
        <div className="text-v2-ink-subtle">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>

        {/* Workspace Icon/Logo */}
        {integration.workspace_logo_url ? (
          <div className="w-7 h-7 rounded overflow-hidden border border-v2-ring flex-shrink-0">
            <img
              src={integration.workspace_logo_url}
              alt={integration.display_name || integration.team_name}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div
            className={`p-1.5 rounded ${!isActive ? "bg-amber-100 dark:bg-amber-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}
          >
            <Building2
              className={`h-4 w-4 ${!isActive ? "text-amber-600 dark:text-amber-400" : "text-purple-600 dark:text-purple-400"}`}
            />
          </div>
        )}

        {/* Workspace Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-v2-ink truncate">
              {integration.display_name || integration.team_name}
            </span>
            {!isActive ? (
              <Badge
                variant="secondary"
                className="text-[8px] h-4 px-1 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
              >
                <XCircle className="h-2 w-2 mr-0.5" />
                Paused
              </Badge>
            ) : isConnected ? (
              <Badge
                variant="default"
                className="text-[8px] h-4 px-1 bg-green-600"
              >
                <CheckCircle2 className="h-2 w-2 mr-0.5" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[8px] h-4 px-1">
                <XCircle className="h-2 w-2 mr-0.5" />
                Disconnected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {integration.policy_channel_name && (
              <p className="text-[10px] text-v2-ink-muted flex items-center gap-1">
                <Hash className="h-2.5 w-2.5" />
                {integration.policy_channel_name}
              </p>
            )}
            {/* Agency context indicator */}
            <Badge
              variant="outline"
              className="text-[8px] h-3.5 px-1 border-v2-ring dark:border-v2-ring"
            >
              {integration.agency_id ? "Agency" : "IMO-Level"}
            </Badge>
          </div>
        </div>

        {/* Quick Actions */}
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Active Toggle - Admin Only */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-v2-ring">
              <Switch
                checked={isActive}
                onCheckedChange={handleToggleActive}
                disabled={toggleActive.isPending}
                className="scale-75"
              />
              <span
                className={`text-[9px] font-medium ${isActive ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}
              >
                {isActive ? "ON" : "OFF"}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleTestConnection}
            disabled={testConnection.isPending || !isActive}
            title="Test connection"
          >
            {testConnection.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[9px] text-purple-500 hover:text-purple-600"
                onClick={handleReauthorize}
                disabled={reauthorize.isPending}
                title="Re-authorize with updated permissions"
              >
                {reauthorize.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Re-authorize"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[9px] text-amber-500 hover:text-amber-600"
                onClick={handleDisconnect}
                disabled={disconnectSlack.isPending}
              >
                Disconnect
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[9px] text-red-600 hover:text-red-700 font-medium"
                onClick={handleDelete}
                disabled={deleteSlack.isPending}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Settings */}
      {isExpanded && isConnected && (
        <div className="p-3 bg-v2-canvas dark:bg-v2-card-tinted/30 space-y-4">
          {/* Channel Settings - Admin Only for Editing */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wide">
              Channel Settings
              {!isAdmin && (
                <span className="ml-2 text-[8px] font-normal text-v2-ink-subtle">
                  (Admin only)
                </span>
              )}
            </h5>

            {channelsLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-3 w-3 animate-spin text-v2-ink-subtle" />
                <span className="text-[10px] text-v2-ink-muted">
                  Loading channels...
                </span>
              </div>
            ) : !isAdmin ? (
              /* Read-only view for non-admins */
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    Policy Sales
                  </Label>
                  <div className="h-7 px-2 flex items-center text-[10px] bg-v2-ring rounded border border-v2-ring">
                    {integration.policy_channel_name ? (
                      <span className="flex items-center gap-1">
                        <Hash className="h-2.5 w-2.5" />
                        {integration.policy_channel_name}
                      </span>
                    ) : (
                      <span className="text-v2-ink-subtle">Not configured</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    Leaderboard
                  </Label>
                  <div className="h-7 px-2 flex items-center text-[10px] bg-v2-ring rounded border border-v2-ring">
                    {integration.leaderboard_channel_name ? (
                      <span className="flex items-center gap-1">
                        <Hash className="h-2.5 w-2.5" />
                        {integration.leaderboard_channel_name}
                      </span>
                    ) : (
                      <span className="text-v2-ink-subtle">Not configured</span>
                    )}
                  </div>
                </div>
              </div>
            ) : availableChannels.length === 0 ? (
              <div className="text-[10px] text-v2-ink-muted py-2">
                No channels available. Invite the bot to channels first.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Policy Sales Channel */}
                <div className="space-y-1">
                  <Label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    Policy Sales
                  </Label>
                  <Select
                    value={integration.policy_channel_id || ""}
                    onValueChange={(value) =>
                      handleChannelSelect("policy", value)
                    }
                  >
                    <SelectTrigger className="h-7 text-[10px]">
                      <SelectValue placeholder="Select...">
                        {integration.policy_channel_name ? (
                          <span className="flex items-center gap-1">
                            <Hash className="h-2.5 w-2.5" />
                            {integration.policy_channel_name}
                          </span>
                        ) : (
                          "Select..."
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableChannels.map((channel: SlackChannel) => (
                        <SelectItem
                          key={channel.id}
                          value={channel.id}
                          className="text-[10px]"
                        >
                          <span className="flex items-center gap-1">
                            <Hash className="h-2.5 w-2.5" />
                            {channel.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Leaderboard Channel */}
                <div className="space-y-1">
                  <Label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    Leaderboard
                  </Label>
                  <Select
                    value={integration.leaderboard_channel_id || ""}
                    onValueChange={(value) =>
                      handleChannelSelect("leaderboard", value)
                    }
                  >
                    <SelectTrigger className="h-7 text-[10px]">
                      <SelectValue placeholder="Select...">
                        {integration.leaderboard_channel_name ? (
                          <span className="flex items-center gap-1">
                            <Hash className="h-2.5 w-2.5" />
                            {integration.leaderboard_channel_name}
                          </span>
                        ) : (
                          "Select..."
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableChannels.map((channel: SlackChannel) => (
                        <SelectItem
                          key={channel.id}
                          value={channel.id}
                          className="text-[10px]"
                        >
                          <span className="flex items-center gap-1">
                            <Hash className="h-2.5 w-2.5" />
                            {channel.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Toggle Options - Admin Only */}
            {isAdmin && (
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                <label className="flex items-center gap-2 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  <Switch
                    checked={integration.include_client_info || false}
                    onCheckedChange={(checked) =>
                      handleToggleSetting("include_client_info", checked)
                    }
                    disabled={updateSettings.isPending}
                    className="scale-75"
                  />
                  Include client name
                </label>
                <label className="flex items-center gap-2 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  <Switch
                    checked={
                      integration.include_leaderboard_with_policy ?? true
                    }
                    onCheckedChange={(checked) =>
                      handleToggleSetting(
                        "include_leaderboard_with_policy",
                        checked,
                      )
                    }
                    disabled={updateSettings.isPending}
                    className="scale-75"
                  />
                  Leaderboard with each sale
                </label>
              </div>
            )}
          </div>

          {/* Workspace Branding - Admin Only */}
          {isAdmin && (
            <div className="space-y-3 pt-3 border-t border-v2-ring">
              <h5 className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wide">
                Workspace Branding
              </h5>
              <WorkspaceLogoUpload
                integrationId={integration.id}
                currentLogoUrl={integration.workspace_logo_url}
                disabled={!isActive}
              />
            </div>
          )}

          {/* Your Preferences for this Workspace */}
          {!channelsLoading && availableChannels.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-v2-ring">
              <h5 className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wide">
                Your Preferences
              </h5>

              {/* Default View Channel */}
              <div className="space-y-1">
                <Label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Default Channel (Messages Tab)
                </Label>
                <Select
                  value={
                    userPrefs?.default_view_integration_id === integration.id
                      ? userPrefs?.default_view_channel_id || ""
                      : ""
                  }
                  onValueChange={handleSetDefaultViewChannel}
                >
                  <SelectTrigger className="h-7 text-[10px]">
                    <SelectValue placeholder="Select default...">
                      {userPrefs?.default_view_integration_id ===
                        integration.id &&
                      userPrefs?.default_view_channel_name ? (
                        <span className="flex items-center gap-1">
                          <Hash className="h-2.5 w-2.5" />
                          {userPrefs.default_view_channel_name}
                        </span>
                      ) : (
                        "Select default..."
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableChannels.map((channel: SlackChannel) => (
                      <SelectItem
                        key={channel.id}
                        value={channel.id}
                        className="text-[10px]"
                      >
                        <span className="flex items-center gap-1">
                          <Hash className="h-2.5 w-2.5" />
                          {channel.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Channels */}
              <div className="space-y-1">
                <Label className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Additional Channels for My Sales
                </Label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {availableChannels
                    .filter(
                      (c: SlackChannel) =>
                        c.id !== integration.policy_channel_id,
                    )
                    .map((channel: SlackChannel) => {
                      const isSelected = (
                        userPrefs?.policy_post_channels ?? []
                      ).some(
                        (c) =>
                          c.integration_id === integration.id &&
                          c.channel_id === channel.id,
                      );
                      return (
                        <label
                          key={channel.id}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] cursor-pointer border transition-colors ${
                            isSelected
                              ? "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                              : "bg-v2-card border-v2-ring text-v2-ink-muted dark:text-v2-ink-subtle hover:border-purple-300 dark:hover:border-purple-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              handleToggleAdditionalChannel(
                                channel.id,
                                channel.name,
                                e.target.checked,
                              )
                            }
                            className="sr-only"
                            disabled={isUpdatingUserPrefs}
                          />
                          <Hash className="h-2.5 w-2.5" />
                          {channel.name}
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disconnected State */}
      {isExpanded && !isConnected && (
        <div className="p-3 bg-v2-canvas dark:bg-v2-card-tinted/30">
          <p className="text-[10px] text-v2-ink-muted">
            This workspace is disconnected. Remove it or reconnect by adding it
            again.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-component: Webhook Card
// ============================================================================

interface WebhookCardProps {
  webhook: SlackWebhook;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  isDeleting: boolean;
  isUpdating: boolean;
}

function WebhookCard({
  webhook,
  onDelete,
  onToggle,
  isDeleting,
  isUpdating,
}: WebhookCardProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-v2-canvas rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        <Link2 className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-v2-ink truncate">
              {webhook.channel_name}
            </span>
            {webhook.workspace_name && (
              <span className="text-[9px] text-v2-ink-subtle truncate">
                ({webhook.workspace_name})
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Switch
          checked={webhook.notifications_enabled ?? true}
          onCheckedChange={(checked) => onToggle(webhook.id, checked)}
          disabled={isUpdating}
          className="scale-75"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-v2-ink-subtle hover:text-red-500"
          onClick={() => onDelete(webhook.id)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-component: Add Webhook Dialog
// ============================================================================

interface AddWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (
    webhookUrl: string,
    channelName: string,
    workspaceName: string,
  ) => Promise<void>;
  isAdding: boolean;
}

function AddWebhookDialog({
  open,
  onOpenChange,
  onAdd,
  isAdding,
}: AddWebhookDialogProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelName, setChannelName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    if (!webhookUrl.trim()) {
      setError("Webhook URL is required");
      return;
    }

    if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
      setError(
        "Invalid webhook URL. It should start with https://hooks.slack.com/",
      );
      return;
    }

    if (!channelName.trim()) {
      setError("Channel name is required");
      return;
    }

    try {
      await onAdd(webhookUrl.trim(), channelName.trim(), workspaceName.trim());
      setWebhookUrl("");
      setChannelName("");
      setWorkspaceName("");
      onOpenChange(false);
    } catch {
      setError("Failed to add webhook");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Add Slack Webhook</DialogTitle>
          <DialogDescription className="text-[11px]">
            Webhooks let you post notifications to any Slack workspace without
            OAuth.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Instructions */}
          <div className="bg-v2-canvas rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-medium text-v2-ink-muted">
              How to get a webhook URL:
            </p>
            <ol className="text-[9px] text-v2-ink-muted space-y-1 list-decimal list-inside">
              <li>Go to your Slack workspace</li>
              <li>Open Apps → Incoming Webhooks</li>
              <li>Click "Add New Webhook to Workspace"</li>
              <li>Select the channel and copy the URL</li>
            </ol>
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[9px] text-purple-600 hover:text-purple-700"
            >
              Learn more <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          {/* Form fields */}
          <div className="space-y-2">
            <div>
              <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                Webhook URL *
              </Label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="h-8 text-[11px] mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                Channel Name *
              </Label>
              <Input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="#sales"
                className="h-8 text-[11px] mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                Workspace Name (optional)
              </Label>
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Partner Agency"
                className="h-8 text-[11px] mt-1"
              />
            </div>
          </div>

          {error && <p className="text-[10px] text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-[10px]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isAdding}
            className="h-7 text-[10px]"
          >
            {isAdding ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Plus className="h-3 w-3 mr-1" />
            )}
            Add Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Sub-component: Agency Slack Credentials Dialog
// ============================================================================

interface AgencySlackCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imoId: string;
  existingCredentials?: {
    id: string;
    client_id: string;
    app_name: string | null;
    agency_id: string | null;
  } | null;
}

function AgencySlackCredentialsDialog({
  open,
  onOpenChange,
  imoId,
  existingCredentials,
}: AgencySlackCredentialsDialogProps) {
  const queryClient = useQueryClient();

  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(
    existingCredentials?.agency_id || null,
  );
  const [clientId, setClientId] = useState(
    existingCredentials?.client_id || "",
  );
  const [clientSecret, setClientSecret] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [appName, setAppName] = useState(existingCredentials?.app_name || "");
  const [showSecrets, setShowSecrets] = useState(false);
  const [error, setError] = useState("");

  // Fetch agencies for the dropdown
  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies-for-slack", imoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("imo_id", imoId)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    enabled: open && !!imoId,
  });

  // Reset form when dialog opens or existingCredentials changes
  useEffect(() => {
    if (open) {
      setSelectedAgencyId(existingCredentials?.agency_id || null);
      setClientId(existingCredentials?.client_id || "");
      setClientSecret("");
      setSigningSecret("");
      setAppName(existingCredentials?.app_name || "");
      setError("");
    }
  }, [open, existingCredentials]);

  const saveCredentials = useMutation({
    mutationFn: async () => {
      // Get the current session to pass the auth token explicitly
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated. Please log in again.");
      }

      console.log(
        "[SlackCredentials] Invoking function with token:",
        accessToken.slice(0, 20) + "...",
      );

      // Call edge function to encrypt and store credentials
      const { data, error } = await supabase.functions.invoke(
        "slack-store-credentials",
        {
          body: {
            imoId,
            agencyId: selectedAgencyId || null,
            clientId,
            clientSecret: clientSecret || undefined, // Only send if provided
            signingSecret: signingSecret || undefined,
            appName: appName || undefined,
            existingId: existingCredentials?.id,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      // Handle function errors - extract message from response if available
      if (error) {
        console.error(
          "[SlackCredentials] Function error:",
          error,
          "Data:",
          data,
        );
        // Try to get the actual error message from the response
        const errorMessage =
          data?.error || error.message || "Failed to save credentials";
        throw new Error(errorMessage);
      }
      if (!data?.ok)
        throw new Error(data?.error || "Failed to save credentials");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-slack-credentials"] });
      toast.success("Slack app credentials saved successfully");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = async () => {
    setError("");

    if (!clientId.trim()) {
      setError("Client ID is required");
      return;
    }

    // Require secret on new credentials, optional on update
    if (!existingCredentials && !clientSecret.trim()) {
      setError("Client Secret is required for new credentials");
      return;
    }

    saveCredentials.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4 text-purple-500" />
            {existingCredentials ? "Update" : "Add"} Slack App Credentials
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Configure Slack app credentials for a specific agency or as IMO
            default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Instructions */}
          <div className="bg-v2-canvas rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-medium text-v2-ink-muted">
              How to get Slack app credentials:
            </p>
            <ol className="text-[9px] text-v2-ink-muted space-y-1 list-decimal list-inside">
              <li>Go to api.slack.com/apps and create or select your app</li>
              <li>Find Client ID & Client Secret in "Basic Information"</li>
              <li>Enable OAuth & add redirect URL</li>
              <li>
                Add the Bot Token Scopes: chat:write, channels:read,
                channels:join, users:read
              </li>
            </ol>
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[9px] text-purple-600 hover:text-purple-700"
            >
              Open Slack App Dashboard <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          {/* Form fields */}
          <div className="space-y-3">
            {/* Agency Selector */}
            <div>
              <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                Agency *
              </Label>
              <Select
                value={selectedAgencyId || "imo-default"}
                onValueChange={(value) =>
                  setSelectedAgencyId(value === "imo-default" ? null : value)
                }
              >
                <SelectTrigger className="h-8 text-[11px] mt-1">
                  <SelectValue placeholder="Select agency..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imo-default" className="text-[11px]">
                    IMO Default (all agencies)
                  </SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem
                      key={agency.id}
                      value={agency.id}
                      className="text-[11px]"
                    >
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[8px] text-v2-ink-subtle mt-0.5">
                Choose a specific agency or set as IMO-wide default
              </p>
            </div>

            <div>
              <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                App Name (optional)
              </Label>
              <Input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g., Self Made Sales Bot"
                className="h-8 text-[11px] mt-1"
              />
            </div>

            <div>
              <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                Client ID *
              </Label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g., 1234567890.1234567890"
                className="h-8 text-[11px] mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle flex items-center gap-1">
                Client Secret{" "}
                {existingCredentials ? "(leave blank to keep existing)" : "*"}
              </Label>
              <div className="relative">
                <Input
                  type={showSecrets ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={
                    existingCredentials ? "••••••••••••" : "Enter client secret"
                  }
                  className="h-8 text-[11px] mt-1 font-mono pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-v2-ink-subtle hover:text-v2-ink-muted"
                >
                  {showSecrets ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                Signing Secret (optional)
              </Label>
              <div className="relative">
                <Input
                  type={showSecrets ? "text" : "password"}
                  value={signingSecret}
                  onChange={(e) => setSigningSecret(e.target.value)}
                  placeholder={
                    existingCredentials
                      ? "••••••••••••"
                      : "Enter signing secret"
                  }
                  className="h-8 text-[11px] mt-1 font-mono pr-8"
                />
              </div>
              <p className="text-[8px] text-v2-ink-subtle mt-0.5">
                Used for verifying Slack webhooks (optional)
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2">
              <XCircle className="h-3 w-3" />
              {error}
            </div>
          )}

          {/* Security note */}
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
            <Shield className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[9px] text-amber-700 dark:text-amber-300">
              Secrets are encrypted before storage and never displayed after
              saving.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-[10px]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saveCredentials.isPending}
            className="h-7 text-[10px]"
          >
            {saveCredentials.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Key className="h-3 w-3 mr-1" />
            )}
            {existingCredentials ? "Update" : "Save"} Credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SlackIntegrationCard() {
  const { data: integrations = [], isLoading } = useSlackIntegrations();
  const { data: userPrefs } = useUserSlackPreferences();
  const { data: webhooks = [], isLoading: webhooksLoading } =
    useSlackWebhooks();
  const connectSlack = useConnectSlack();
  const updateUserPrefs = useUpdateUserSlackPreferences();
  const addWebhook = useAddSlackWebhook();
  const updateWebhook = useUpdateSlackWebhook();
  const deleteWebhook = useDeleteSlackWebhook();

  const { imo, isSuperAdmin } = useImo();
  const { user } = useAuth();

  // Super admins can manage Slack. Kerry Glass (Self Made Financial workspace
  // owner) is explicitly allowlisted so he can authorize the Slack bot for his
  // workspace without being granted full super-admin privileges.
  const SLACK_ADMIN_ALLOWLIST = ["kerryglass.ffl@gmail.com"];
  const canManageSlack =
    isSuperAdmin ||
    (!!user?.email && SLACK_ADMIN_ALLOWLIST.includes(user.email.toLowerCase()));

  const [showUserPrefs, setShowUserPrefs] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);

  // Fetch existing Slack app credentials with agency names
  const { data: slackCredentials, isLoading: credentialsLoading } = useQuery({
    queryKey: ["agency-slack-credentials", imo?.id],
    queryFn: async () => {
      if (!imo?.id) return null;
      const { data, error } = await supabase
        .from("agency_slack_credentials")
        .select(
          "id, client_id, app_name, agency_id, created_at, agencies(name)",
        )
        .eq("imo_id", imo.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Supabase returns joined table as an array for one-to-many, object for many-to-one
      // The FK is on agency_slack_credentials, so it's many-to-one (returns object)
      // But TypeScript sees it as an array, so we handle both cases
      type CredentialRow = {
        id: string;
        client_id: string;
        app_name: string | null;
        agency_id: string | null;
        created_at: string;
        agencies: { name: string } | { name: string }[] | null;
      };
      return (data as CredentialRow[]).map((row) => ({
        ...row,
        agencies: Array.isArray(row.agencies)
          ? row.agencies[0] || null
          : row.agencies,
      }));
    },
    enabled: !!imo?.id && canManageSlack,
  });

  const connectedIntegrations = integrations.filter((i) => i.isConnected);
  const hasConnections = connectedIntegrations.length > 0;

  const handleConnect = async () => {
    try {
      // Pass absolute URL for redirect after OAuth
      const returnUrl = `${window.location.origin}/settings/integrations`;
      await connectSlack.mutateAsync(returnUrl);
    } catch {
      toast.error("Failed to initiate Slack connection");
    }
  };

  const handleUpdateUserPrefs = async (input: {
    policyPostChannels?: PolicyPostChannel[];
    autoPostEnabled?: boolean;
    defaultViewChannelId?: string | null;
    defaultViewChannelName?: string | null;
    defaultViewIntegrationId?: string | null;
  }) => {
    await updateUserPrefs.mutateAsync(input);
  };

  const handleToggleAutoPost = async (enabled: boolean) => {
    try {
      await updateUserPrefs.mutateAsync({ autoPostEnabled: enabled });
      toast.success(
        enabled
          ? "Auto-posting enabled"
          : "Auto-posting disabled for your sales",
      );
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const handleAddWebhook = async (
    webhookUrl: string,
    channelName: string,
    workspaceName: string,
  ) => {
    await addWebhook.mutateAsync({
      webhookUrl,
      channelName,
      workspaceName: workspaceName || undefined,
    });
    toast.success(`Added webhook for ${channelName}`);
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm("Are you sure you want to remove this webhook?")) return;
    try {
      await deleteWebhook.mutateAsync(webhookId);
      toast.success("Webhook removed");
    } catch {
      toast.error("Failed to remove webhook");
    }
  };

  const handleToggleWebhook = async (webhookId: string, enabled: boolean) => {
    try {
      await updateWebhook.mutateAsync({
        webhookId,
        updates: { notifications_enabled: enabled },
      });
    } catch {
      toast.error("Failed to update webhook");
    }
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
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-v2-ink">Slack</h3>
              {hasConnections ? (
                <Badge
                  variant="default"
                  className="text-[9px] h-4 px-1.5 bg-green-600"
                >
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                  {connectedIntegrations.length} Workspace
                  {connectedIntegrations.length > 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  <XCircle className="h-2.5 w-2.5 mr-0.5" />
                  Not Connected
                </Badge>
              )}
            </div>

            <p className="text-[10px] text-v2-ink-muted mt-1">
              {hasConnections
                ? "Post policy sales and leaderboards to your Slack workspaces."
                : "Connect Slack workspaces to enable automated notifications."}
            </p>
          </div>

          {/* Add Workspace Button - Admin Only */}
          {canManageSlack && (
            <Button
              size="sm"
              variant={hasConnections ? "outline" : "default"}
              className="h-7 px-3 text-[10px]"
              onClick={handleConnect}
              disabled={connectSlack.isPending}
            >
              {connectSlack.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              {hasConnections ? "Add Workspace" : "Connect Slack"}
            </Button>
          )}
        </div>
      </div>

      {/* Connected Workspaces List */}
      {integrations.length > 0 && (
        <div className="bg-v2-card rounded-lg border border-v2-ring p-3 space-y-2">
          <h4 className="text-[11px] font-semibold text-v2-ink mb-2">
            Connected Workspaces
          </h4>

          <div className="space-y-2">
            {integrations.map((integration) => (
              <WorkspaceCard
                key={integration.id}
                integration={integration}
                userPrefs={userPrefs ?? null}
                onUpdateUserPrefs={handleUpdateUserPrefs}
                isUpdatingUserPrefs={updateUserPrefs.isPending}
                isAdmin={canManageSlack}
              />
            ))}
          </div>
        </div>
      )}

      {/* Slack App Credentials Section - Admin Only */}
      {canManageSlack && (
        <div className="bg-v2-card rounded-lg border border-v2-ring p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[11px] font-semibold text-v2-ink flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-purple-500" />
                Slack App Credentials
              </h4>
              <p className="text-[9px] text-v2-ink-subtle">
                Configure Slack app credentials for OAuth connections
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[9px]"
              onClick={() => setShowCredentialsDialog(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Credentials
            </Button>
          </div>

          {credentialsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3 w-3 animate-spin text-v2-ink-subtle" />
              <span className="text-[10px] text-v2-ink-muted">
                Loading credentials...
              </span>
            </div>
          ) : !slackCredentials || slackCredentials.length === 0 ? (
            <div className="py-3 text-center">
              <Shield className="h-5 w-5 text-v2-ink-subtle mx-auto mb-1" />
              <p className="text-[10px] text-v2-ink-muted">
                No Slack app credentials configured. Add credentials to enable
                OAuth for your agencies.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {slackCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between py-2 px-3 bg-v2-canvas rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Key className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-v2-ink truncate">
                          {cred.app_name || "Slack App"}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[8px] h-3.5 px-1 border-v2-ring dark:border-v2-ring"
                        >
                          {cred.agencies?.name || "IMO Default"}
                        </Badge>
                      </div>
                      <span className="text-[9px] text-v2-ink-subtle font-mono">
                        {cred.client_id.slice(0, 12)}...
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[9px]"
                    onClick={() => {
                      // TODO: Open edit dialog with this credential
                      setShowCredentialsDialog(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Credentials Dialog */}
          {imo && (
            <AgencySlackCredentialsDialog
              open={showCredentialsDialog}
              onOpenChange={setShowCredentialsDialog}
              imoId={imo.id}
              existingCredentials={null}
            />
          )}
        </div>
      )}

      {/* Notification Webhooks Section - Admin Only */}
      {canManageSlack && (
        <div className="bg-v2-card rounded-lg border border-v2-ring p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[11px] font-semibold text-v2-ink">
                Notification Webhooks
              </h4>
              <p className="text-[9px] text-v2-ink-subtle">
                Post notifications to any workspace without OAuth
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[9px]"
              onClick={() => setShowAddWebhook(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Webhook
            </Button>
          </div>

          {webhooksLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3 w-3 animate-spin text-v2-ink-subtle" />
              <span className="text-[10px] text-v2-ink-muted">
                Loading webhooks...
              </span>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="py-3 text-center">
              <Link2 className="h-5 w-5 text-v2-ink-subtle mx-auto mb-1" />
              <p className="text-[10px] text-v2-ink-muted">
                No webhooks configured. Add one to post notifications to other
                workspaces.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {webhooks.map((webhook) => (
                <WebhookCard
                  key={webhook.id}
                  webhook={webhook}
                  onDelete={handleDeleteWebhook}
                  onToggle={handleToggleWebhook}
                  isDeleting={deleteWebhook.isPending}
                  isUpdating={updateWebhook.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Webhook Dialog */}
      <AddWebhookDialog
        open={showAddWebhook}
        onOpenChange={setShowAddWebhook}
        onAdd={handleAddWebhook}
        isAdding={addWebhook.isPending}
      />

      {/* Global User Preferences */}
      {hasConnections && (
        <div className="bg-v2-card rounded-lg border border-v2-ring p-3">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowUserPrefs(!showUserPrefs)}
          >
            <div>
              <h4 className="text-[11px] font-semibold text-v2-ink">
                Global Preferences
              </h4>
              <p className="text-[9px] text-v2-ink-subtle">
                Settings that apply across all workspaces
              </p>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-v2-ink-subtle transition-transform ${
                showUserPrefs ? "rotate-180" : ""
              }`}
            />
          </div>

          {showUserPrefs && (
            <div className="mt-3 pt-3 border-t border-v2-ring/60">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    Auto-post my sales to Slack
                  </Label>
                  <p className="text-[9px] text-v2-ink-subtle">
                    Automatically post when you create a policy
                  </p>
                </div>
                <Switch
                  checked={userPrefs?.auto_post_enabled ?? true}
                  onCheckedChange={handleToggleAutoPost}
                  disabled={updateUserPrefs.isPending}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
