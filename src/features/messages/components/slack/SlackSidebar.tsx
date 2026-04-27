// src/features/messages/components/slack/SlackSidebar.tsx
// Slack channel list sidebar - mirrors real Slack workspace structure

import { useState } from "react";
import {
  Hash,
  Lock,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSlackChannelsById } from "@/hooks/slack";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SlackChannel, SlackIntegration } from "@/types/slack.types";

interface SlackSidebarProps {
  selectedChannelId: string | null;
  selectedIntegrationId: string | null;
  integrations: SlackIntegration[];
  onChannelSelect: (channel: SlackChannel) => void;
  onWorkspaceChange: (integrationId: string) => void;
}

export function SlackSidebar({
  selectedChannelId,
  selectedIntegrationId,
  integrations,
  onChannelSelect,
  onWorkspaceChange,
}: SlackSidebarProps) {
  const {
    data: channels,
    isLoading,
    refetch,
  } = useSlackChannelsById(selectedIntegrationId ?? undefined);
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const selectedWorkspace = integrations.find(
    (i) => i.id === selectedIntegrationId,
  );

  // Separate public and private channels
  const publicChannels =
    channels?.filter((c) => !c.is_private && c.is_member) || [];
  const privateChannels =
    channels?.filter((c) => c.is_private && c.is_member) || [];
  const otherChannels = channels?.filter((c) => !c.is_member) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Workspace selector / name */}
      <div className="px-2 py-2 border-b border-v2-ring">
        <div className="flex items-center justify-between gap-1">
          {integrations.length > 1 ? (
            <Select
              value={selectedIntegrationId ?? ""}
              onValueChange={onWorkspaceChange}
            >
              <SelectTrigger className="h-6 text-[10px] flex-1 min-w-0">
                <SelectValue placeholder="Select workspace">
                  {selectedWorkspace?.display_name ||
                    selectedWorkspace?.team_name ||
                    "Select..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {integrations.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id} className="text-[10px]">
                    {ws.display_name || ws.team_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-[11px] font-semibold text-v2-ink truncate">
              {selectedWorkspace?.team_name || "Slack"}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 flex-shrink-0"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-1.5 space-y-2">
        {/* Channels section */}
        <div>
          <button
            onClick={() => setChannelsExpanded(!channelsExpanded)}
            className="w-full flex items-center gap-1 px-1.5 py-1 text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide hover:text-v2-ink"
          >
            {channelsExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Channels
            <span className="ml-auto text-[9px] font-normal">
              {publicChannels.length + privateChannels.length}
            </span>
          </button>

          {channelsExpanded && (
            <div className="space-y-0.5 mt-0.5">
              {/* Public channels */}
              {publicChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannelId === channel.id}
                  onClick={() => onChannelSelect(channel)}
                />
              ))}

              {/* Private channels */}
              {privateChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannelId === channel.id}
                  onClick={() => onChannelSelect(channel)}
                  isPrivate
                />
              ))}

              {publicChannels.length === 0 && privateChannels.length === 0 && (
                <div className="px-2 py-3 text-center">
                  <p className="text-[10px] text-v2-ink-subtle">
                    No channels joined
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Other channels (not joined) */}
        {otherChannels.length > 0 && (
          <div>
            <div className="px-1.5 py-1 text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
              Browse Channels
            </div>
            <div className="space-y-0.5 mt-0.5 max-h-32 overflow-auto">
              {otherChannels.slice(0, 10).map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isSelected={false}
                  onClick={() => onChannelSelect(channel)}
                  dimmed
                />
              ))}
              {otherChannels.length > 10 && (
                <p className="px-2 py-1 text-[9px] text-v2-ink-subtle">
                  +{otherChannels.length - 10} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChannelItemProps {
  channel: SlackChannel;
  isSelected: boolean;
  onClick: () => void;
  isPrivate?: boolean;
  dimmed?: boolean;
}

function ChannelItem({
  channel,
  isSelected,
  onClick,
  isPrivate,
  dimmed,
}: ChannelItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors",
        isSelected
          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
          : dimmed
            ? "text-v2-ink-subtle hover:text-v2-ink-muted dark:hover:text-v2-ink-subtle hover:bg-v2-canvas"
            : "text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink hover:bg-v2-canvas",
      )}
    >
      {isPrivate ? (
        <Lock className="h-3 w-3 flex-shrink-0" />
      ) : (
        <Hash className="h-3 w-3 flex-shrink-0" />
      )}
      <span className="truncate">{channel.name}</span>
    </button>
  );
}
