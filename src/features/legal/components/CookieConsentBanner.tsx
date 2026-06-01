// src/features/legal/components/CookieConsentBanner.tsx
import React from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "../hooks/useCookieConsent";

export function CookieConsentBanner() {
  const { hasConsented, acceptConsent } = useCookieConsent();

  if (hasConsented) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex-1 text-sm text-muted-foreground">
          <p>
            We use cookies for authentication and to remember your preferences.
            Your data is never sold.{" "}
            <Link
              to="/privacy"
              className="text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={acceptConsent}
            className="whitespace-nowrap"
          >
            Got it
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={acceptConsent}
            className="h-8 w-8"
            aria-label="Close cookie banner"
          >
            <X size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
