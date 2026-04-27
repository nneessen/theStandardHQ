// Custom Domain Error Page
// Shown when a custom domain cannot be resolved

import React from "react";
import { Globe, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomDomainErrorProps {
  hostname: string;
}

export function CustomDomainError({ hostname }: CustomDomainErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-v2-canvas p-4">
      <div className="w-full max-w-md rounded-lg border border-v2-ring bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-v2-ring">
          <Globe className="h-6 w-6 text-v2-ink-subtle" />
        </div>

        <h1 className="mt-4 text-lg font-semibold text-v2-ink">
          Domain Not Configured
        </h1>

        <p className="mt-2 text-sm text-v2-ink-muted">
          The domain <strong className="font-medium">{hostname}</strong> is not
          connected to a recruiting page.
        </p>

        <div className="mt-4 rounded-md bg-v2-canvas p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-v2-ink-subtle" />
            <div className="text-left text-xs text-v2-ink-muted">
              <p className="font-medium">If you own this domain:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>Verify DNS records are configured correctly</li>
                <li>Complete domain verification in your settings</li>
                <li>Wait for SSL certificate provisioning</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Button asChild className="w-full">
            <a href="https://www.thestandardhq.com">
              <ExternalLink className="mr-2 h-4 w-4" />
              Go to The Standard HQ
            </a>
          </Button>

          <p className="text-xs text-v2-ink-muted">
            Need help?{" "}
            <a
              href="mailto:support@thestandardhq.com"
              className="text-v2-ink underline hover:text-v2-ink"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
