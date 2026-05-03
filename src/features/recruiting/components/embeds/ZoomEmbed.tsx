// src/features/recruiting/components/embeds/ZoomEmbed.tsx

import { useState } from "react";
import { Video, Copy, ExternalLink, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ZoomEmbedProps {
  url: string;
  meetingId?: string;
  passcode?: string;
  instructions?: string;
  className?: string;
}

export function ZoomEmbed({
  url,
  meetingId,
  passcode,
  instructions,
  className = "",
}: ZoomEmbedProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field} copied to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Validate URL
  if (!url) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 bg-v2-canvas rounded-lg ${className}`}
      >
        <AlertCircle className="h-8 w-8 text-warning mb-3" />
        <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle text-center">
          No Zoom link provided
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center p-6 bg-v2-canvas rounded-lg ${className}`}
    >
      {/* Zoom Icon */}
      <div className="w-16 h-16 rounded-full bg-info/15 flex items-center justify-center mb-4">
        <Video className="h-8 w-8 text-info" />
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-v2-ink mb-2">Zoom Meeting</h3>

      {/* Instructions */}
      {instructions && (
        <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle text-center mb-4 max-w-sm">
          {instructions}
        </p>
      )}

      {/* Meeting Details */}
      <div className="w-full max-w-sm space-y-2 mb-4">
        {/* Meeting ID */}
        {meetingId && (
          <div className="flex items-center justify-between p-2 bg-v2-card rounded-lg">
            <div>
              <span className="text-[10px] text-v2-ink-muted uppercase tracking-wide">
                Meeting ID
              </span>
              <p className="text-[11px] font-mono text-v2-ink">{meetingId}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => copyToClipboard(meetingId, "Meeting ID")}
            >
              {copiedField === "Meeting ID" ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-v2-ink-subtle" />
              )}
            </Button>
          </div>
        )}

        {/* Passcode */}
        {passcode && (
          <div className="flex items-center justify-between p-2 bg-v2-card rounded-lg">
            <div>
              <span className="text-[10px] text-v2-ink-muted uppercase tracking-wide">
                Passcode
              </span>
              <p className="text-[11px] font-mono text-v2-ink">{passcode}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => copyToClipboard(passcode, "Passcode")}
            >
              {copiedField === "Passcode" ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-v2-ink-subtle" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Join Button */}
      <Button size="sm" className="h-8 text-[11px]" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Join Zoom Meeting
        </a>
      </Button>

      {/* Copy Link */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[10px] mt-2 text-v2-ink-muted"
        onClick={() => copyToClipboard(url, "Link")}
      >
        {copiedField === "Link" ? (
          <>
            <Check className="h-3 w-3 mr-1 text-success" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3 w-3 mr-1" />
            Copy Link
          </>
        )}
      </Button>
    </div>
  );
}
