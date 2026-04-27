// src/features/messages/components/instagram/InstagramConnectCard.tsx
// CTA card shown when user has no Instagram integration

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Instagram,
  Loader2,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { InstagramSetupGuide } from "./InstagramSetupGuide";

interface InstagramConnectCardProps {
  onConnect: () => void;
  isConnecting: boolean;
  /** Error message from failed connection attempt */
  error?: string | null;
  /** Callback to clear the error */
  onClearError?: () => void;
}

export function InstagramConnectCard({
  onConnect,
  isConnecting,
  error,
  onClearError,
}: InstagramConnectCardProps): ReactNode {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <>
      <div className="h-full flex items-center justify-center bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
        <div className="max-w-sm w-full p-6 text-center">
          {/* Instagram Icon with gradient background */}
          <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center mb-4 shadow-lg">
            <Instagram className="h-7 w-7 text-white" />
          </div>

          {/* Title and description */}
          <h3 className="text-sm font-semibold text-v2-ink mb-1">
            Connect Instagram
          </h3>
          <p className="text-[11px] text-v2-ink-muted mb-4">
            Connect your Instagram Business or Creator account to send and
            receive DMs directly from this dashboard.
          </p>

          {/* Requirements box */}
          <div className="bg-v2-canvas rounded-md p-3 mb-4 text-left">
            <p className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide mb-2">
              Requirements
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                <span className="text-[11px] text-v2-ink-muted">
                  Instagram Business or Creator account
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                <span className="text-[11px] text-v2-ink-muted">
                  Connected to a Facebook Page
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                <span className="text-[11px] text-v2-ink-muted">
                  Facebook Page admin access
                </span>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-red-700 dark:text-red-300">
                    Connection failed
                  </p>
                  <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                    {error}
                  </p>
                </div>
                {onClearError && (
                  <button
                    onClick={onClearError}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex-1 h-8 text-[11px] bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 text-white border-0"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Instagram className="h-3 w-3 mr-1.5" />
                  Connect Instagram
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowGuide(true)}
              variant="outline"
              className="h-8 px-3 text-[11px]"
            >
              <HelpCircle className="h-3 w-3 mr-1" />
              Setup Guide
            </Button>
          </div>

          {/* Help text */}
          <p className="text-[10px] text-v2-ink-subtle mt-4">
            Need help?{" "}
            <button
              onClick={() => setShowGuide(true)}
              className="text-blue-500 hover:underline"
            >
              See our Instagram Business Account Setup Guide
            </button>
          </p>
        </div>
      </div>

      {/* Setup Guide Dialog */}
      <InstagramSetupGuide open={showGuide} onOpenChange={setShowGuide} />
    </>
  );
}
