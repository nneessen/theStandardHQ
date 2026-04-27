// src/features/recruiting/components/embeds/GoogleCalendarEmbed.tsx

import { useState } from "react";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoogleCalendarEmbedProps {
  url: string;
  onLoad?: () => void;
  className?: string;
}

export function GoogleCalendarEmbed({
  url,
  onLoad,
  className = "",
}: GoogleCalendarEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setError("Failed to load Google Calendar. Please try again.");
    setIsLoading(false);
  };

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 bg-v2-canvas rounded-lg ${className}`}
      >
        <AlertCircle className="h-8 w-8 text-amber-500 mb-3" />
        <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle text-center mb-3">
          {error}
        </p>
        <Button variant="outline" size="sm" className="h-7 text-[11px]" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 mr-1.5" />
            Open in New Tab
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-v2-canvas rounded-lg z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-v2-ink-subtle" />
            <span className="text-[11px] text-v2-ink-muted">
              Loading calendar...
            </span>
          </div>
        </div>
      )}
      <iframe
        src={url}
        title="Google Calendar Appointment Scheduling"
        className="w-full min-h-[500px] rounded-lg"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        onLoad={handleLoad}
        onError={handleError}
        style={{ border: "none" }}
      />
    </div>
  );
}
