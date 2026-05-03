// src/features/recruiting/components/embeds/CalendlyEmbed.tsx

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendlyEmbedProps {
  url: string;
  onEventScheduled?: () => void;
  className?: string;
}

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: {
        url: string;
        parentElement: HTMLElement;
        prefill?: Record<string, unknown>;
        utm?: Record<string, unknown>;
      }) => void;
    };
  }
}

const CALENDLY_SCRIPT_URL =
  "https://assets.calendly.com/assets/external/widget.js";
const CALENDLY_CSS_URL =
  "https://assets.calendly.com/assets/external/widget.css";

export function CalendlyEmbed({
  url,
  onEventScheduled,
  className = "",
}: CalendlyEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initAttemptedRef = useRef(false);

  const initializeWidget = useCallback(() => {
    if (!containerRef.current || !window.Calendly || initAttemptedRef.current)
      return;
    initAttemptedRef.current = true;

    try {
      // Clear any existing content
      containerRef.current.innerHTML = "";

      // Add URL parameters to hide event description and make calendar more compact
      const embedUrl = new URL(url);
      embedUrl.searchParams.set("hide_event_type_details", "1");
      embedUrl.searchParams.set("hide_gdpr_banner", "1");

      window.Calendly.initInlineWidget({
        url: embedUrl.toString(),
        parentElement: containerRef.current,
      });

      // Give it a moment to render then hide loading
      setTimeout(() => {
        setIsLoading(false);
        setError(null);
      }, 500);
    } catch (err) {
      console.error("Failed to initialize Calendly widget:", err);
      setError("Failed to load calendar. Please try again.");
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    // Listen for Calendly events
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://calendly.com") return;

      if (
        event.data.event === "calendly.event_scheduled" ||
        event.data.event === "calendly.event_type_viewed"
      ) {
        if (
          event.data.event === "calendly.event_scheduled" &&
          onEventScheduled
        ) {
          onEventScheduled();
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onEventScheduled]);

  useEffect(() => {
    // Load CSS if not already loaded
    if (!document.querySelector(`link[href="${CALENDLY_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CALENDLY_CSS_URL;
      document.head.appendChild(link);
    }

    // Check if script is already loaded
    const existingScript = document.querySelector(
      `script[src="${CALENDLY_SCRIPT_URL}"]`,
    );

    if (existingScript && window.Calendly) {
      initializeWidget();
      return;
    }

    if (existingScript) {
      // Script exists but not yet loaded
      const handleLoad = () => initializeWidget();
      existingScript.addEventListener("load", handleLoad);
      return () => existingScript.removeEventListener("load", handleLoad);
    }

    // Load script
    const script = document.createElement("script");
    script.src = CALENDLY_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      initializeWidget();
    };

    script.onerror = () => {
      setError("Failed to load Calendly. Please try again.");
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Reset init flag on unmount so it can reinit if reopened
      initAttemptedRef.current = false;
    };
  }, [initializeWidget]);

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 bg-v2-canvas rounded-lg ${className}`}
      >
        <AlertCircle className="h-8 w-8 text-warning mb-3" />
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
    <div className={`relative ${className}`} style={{ minHeight: 500 }}>
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
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minWidth: 320, minHeight: 500 }}
      />
    </div>
  );
}
