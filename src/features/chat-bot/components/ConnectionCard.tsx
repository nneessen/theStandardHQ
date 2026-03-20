// src/features/chat-bot/components/ConnectionCard.tsx
// Reusable card for displaying Close CRM / Calendly connection status

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConnectionVisualState } from "../lib/connection-state";

interface ConnectionCardProps {
  title: string;
  icon: React.ReactNode;
  connected: boolean;
  state?: ConnectionVisualState;
  statusLabel?: string;
  unavailableLabel?: string;
  isLoading?: boolean;
  // For API key-based connection (Close)
  onConnect?: (apiKey: string) => void;
  connectLoading?: boolean;
  apiKeyPlaceholder?: string;
  // For OAuth-based connection (Calendly)
  onOAuthConnect?: () => void;
  oauthLoading?: boolean;
  oauthLabel?: string;
  // Disconnect
  onDisconnect?: () => void;
  disconnectLoading?: boolean;
}

export function ConnectionCard({
  title,
  icon,
  connected,
  state,
  statusLabel,
  unavailableLabel,
  isLoading,
  onConnect,
  connectLoading,
  apiKeyPlaceholder = "Enter API key...",
  onOAuthConnect,
  oauthLoading,
  oauthLabel = "Connect",
  onDisconnect,
  disconnectLoading,
}: ConnectionCardProps) {
  const [apiKey, setApiKey] = useState("");
  const visualState = state ?? (connected ? "connected" : "disconnected");

  if (isLoading) {
    return (
      <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </span>
          <Loader2 className="h-3 w-3 animate-spin text-zinc-400 ml-auto" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-3 border rounded-lg",
        visualState === "connected"
          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
          : visualState === "unavailable"
            ? "border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20"
            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900",
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
        {visualState === "connected" ? (
          <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 ml-auto">
            <CheckCircle2 className="h-2 w-2 mr-0.5" />
            Connected
          </Badge>
        ) : visualState === "unavailable" ? (
          <Badge className="ml-auto h-4 bg-amber-100 px-1.5 text-[9px] text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
            <Loader2 className="mr-0.5 h-2 w-2" />
            Unavailable
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="text-[9px] h-4 px-1.5 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 ml-auto"
          >
            <XCircle className="h-2 w-2 mr-0.5" />
            Not Connected
          </Badge>
        )}
      </div>

      {/* Status label */}
      {visualState === "connected" && statusLabel && (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2">
          {statusLabel}
        </p>
      )}

      {visualState === "unavailable" && unavailableLabel && (
        <p className="mb-2 text-[10px] text-amber-700 dark:text-amber-300">
          {unavailableLabel}
        </p>
      )}

      {/* Connected state: disconnect button */}
      {visualState === "connected" && onDisconnect && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px] text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
          disabled={disconnectLoading}
          onClick={onDisconnect}
        >
          {disconnectLoading ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
          ) : (
            <Unplug className="h-2.5 w-2.5 mr-1" />
          )}
          Disconnect
        </Button>
      )}

      {/* Not connected: API key input or OAuth button */}
      {visualState === "disconnected" && onConnect && (
        <div className="flex items-center gap-1.5">
          <Input
            type="password"
            placeholder={apiKeyPlaceholder}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="h-7 text-[11px] flex-1"
          />
          <Button
            size="sm"
            className="h-7 text-[10px]"
            disabled={!apiKey.trim() || connectLoading}
            onClick={() => {
              onConnect(apiKey.trim());
              setApiKey("");
            }}
          >
            {connectLoading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            Connect
          </Button>
        </div>
      )}

      {visualState === "disconnected" && onOAuthConnect && (
        <Button
          size="sm"
          className="h-7 text-[10px]"
          disabled={oauthLoading}
          onClick={onOAuthConnect}
        >
          {oauthLoading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          {oauthLabel}
        </Button>
      )}
    </div>
  );
}
