// src/features/close-kpi/components/CloseSettings.tsx
// Settings tab for managing Close CRM API key connection.

import React from "react";
import { Shield, KeyRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  ConnectionCard,
  useConnectClose,
  useDisconnectClose,
  chatBotKeys,
} from "@/features/chat-bot";
import { CloseCrmIcon } from "@/components/icons/CloseCrmIcon";
import {
  closeKpiKeys,
  useCloseConnectionStatus,
} from "../hooks/useCloseKpiDashboard";

export const CloseSettings: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const { data: closeConfig, isLoading: statusLoading } =
    useCloseConnectionStatus();
  const connectClose = useConnectClose();
  const disconnectClose = useDisconnectClose();

  const isConnected = !!closeConfig;

  const handleConnect = (apiKey: string) => {
    connectClose.mutate(apiKey, {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: closeKpiKeys.connectionStatus(userId),
        });
        void queryClient.invalidateQueries({
          queryKey: closeKpiKeys.all,
        });
      },
    });
  };

  const handleDisconnect = () => {
    disconnectClose.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: closeKpiKeys.connectionStatus(userId),
        });
        void queryClient.invalidateQueries({
          queryKey: closeKpiKeys.all,
        });
        void queryClient.invalidateQueries({
          queryKey: chatBotKeys.closeStatus(),
        });
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-sm font-bold text-foreground">
          Close CRM Connection
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Connect your Close account to enable CRM analytics and AI lead scoring
        </p>
      </div>

      {/* Connection Card */}
      <ConnectionCard
        title="Close CRM"
        icon={
          <CloseCrmIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
        }
        connected={isConnected}
        statusLabel={
          closeConfig?.organization_name
            ? `Organization: ${closeConfig.organization_name}`
            : undefined
        }
        isLoading={statusLoading}
        onConnect={handleConnect}
        connectLoading={connectClose.isPending}
        apiKeyPlaceholder="Close API key (api_...)"
        onDisconnect={handleDisconnect}
        disconnectLoading={disconnectClose.isPending}
      />

      {/* Instructions */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <KeyRound className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            How to get your API key
          </h3>
        </div>
        <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Log in to your Close CRM account</li>
          <li>
            Go to{" "}
            <span className="font-medium text-foreground">
              Settings &rarr; Developer
            </span>
          </li>
          <li>
            Click{" "}
            <span className="font-medium text-foreground">+ New API Key</span>,
            give it a name
          </li>
          <li>Copy the key and paste it above</li>
        </ol>
        <div className="flex items-start gap-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-800">
          <Shield className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            Your key is encrypted with AES-256 and never shared with other
            users. Each agent connects their own Close account independently.
          </p>
        </div>
      </div>
    </div>
  );
};
