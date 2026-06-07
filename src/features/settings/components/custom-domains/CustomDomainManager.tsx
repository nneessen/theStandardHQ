// Custom Domain Manager
// Compact list of the user's custom domains + a CTA that opens the full-page
// guided setup wizard. The actual "add a domain" flow lives in
// CustomDomainSetupWizard (route: /recruiting/custom-domains/setup).

import { useNavigate } from "@tanstack/react-router";
import { Globe, Plus, Loader2 } from "lucide-react";
import { useMyCustomDomains } from "@/hooks";
import { DomainCard } from "./DomainCard";

const SETUP_ROUTE = "/recruiting/custom-domains/setup" as const;

export function CustomDomainManager() {
  const navigate = useNavigate();
  const { data: domains, isLoading, error } = useMyCustomDomains();

  const hasActiveDomain = domains?.some((d) => d.status === "active");
  // A domain still being set up (not active, not errored) blocks adding another.
  const hasPendingDomain = domains?.some(
    (d) => d.status !== "active" && d.status !== "error",
  );
  const canAddDomain = !hasActiveDomain && !hasPendingDomain;

  const startSetup = () => navigate({ to: SETUP_ROUTE });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        Failed to load custom domains. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-medium text-v2-ink">Custom Domain</h3>
        </div>
        {canAddDomain && (
          <button
            onClick={startSetup}
            className="flex items-center gap-1 rounded bg-v2-ink px-2.5 py-1 text-xs font-medium text-v2-canvas hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add domain
          </button>
        )}
      </div>

      <p className="text-xs text-v2-ink-muted">
        Connect your own subdomain (e.g., join.yourdomain.com) to your
        recruiting page. We walk you through it step by step.
      </p>

      {/* Domain list, or empty state */}
      {domains && domains.length > 0 ? (
        <div className="space-y-3">
          {domains.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>
      ) : (
        <button
          onClick={startSetup}
          className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-v2-ring p-6 text-center hover:border-v2-ink-subtle hover:bg-v2-ring/30"
        >
          <Globe className="h-5 w-5 text-v2-ink-subtle" />
          <span className="text-sm font-medium text-v2-ink">
            Set up a custom domain
          </span>
          <span className="text-xs text-v2-ink-muted">
            Use your own web address like join.youragency.com
          </span>
        </button>
      )}

      {/* v1 limit notices */}
      {hasActiveDomain && (
        <p className="text-xs text-v2-ink-muted">
          You have an active custom domain. Delete it to add a new one.
        </p>
      )}
      {hasPendingDomain && !hasActiveDomain && (
        <p className="text-xs text-v2-ink-muted">
          Finish or delete your in-progress domain before adding another.
        </p>
      )}
    </div>
  );
}
