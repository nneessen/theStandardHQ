// Custom Domain Manager
// Main component for managing custom domains in user settings

import React from "react";
import { Globe, Plus, Loader2 } from "lucide-react";
import { useMyCustomDomains } from "@/hooks";
import { DomainCard } from "./DomainCard";
import { AddDomainForm } from "./AddDomainForm";
import { DomainSetupGuide } from "./DomainSetupGuide";

export function CustomDomainManager() {
  const { data: domains, isLoading, error } = useMyCustomDomains();
  const [showAddForm, setShowAddForm] = React.useState(false);

  // Check if user already has an active domain (v1 limit)
  const hasActiveDomain = domains?.some((d) => d.status === "active");
  // Check if user has any domain in progress
  const hasPendingDomain = domains?.some(
    (d) => d.status !== "active" && d.status !== "error",
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
        Failed to load custom domains. Please try again.
      </div>
    );
  }

  const canAddDomain = !hasActiveDomain && !hasPendingDomain;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-v2-ink-muted" />
          <h3 className="text-sm font-medium text-v2-ink">Custom Domain</h3>
        </div>
        {canAddDomain && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-xs font-medium text-v2-ink-muted hover:text-v2-ink"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Domain
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-v2-ink-muted">
        Connect your own subdomain (e.g., join.yourdomain.com) to your
        recruiting page. Visitors will see your custom URL in their browser.
      </p>

      {/* Setup Guide - expanded by default when no domains exist */}
      <DomainSetupGuide defaultOpen={!domains || domains.length === 0} />

      {/* Domain List */}
      {domains && domains.length > 0 ? (
        <div className="space-y-3">
          {domains.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>
      ) : !showAddForm ? (
        <div className="rounded-md border border-dashed border-v2-ring p-4 text-center">
          <p className="text-xs text-v2-ink-muted">
            No custom domain configured
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-2 text-xs font-medium text-v2-ink hover:text-v2-ink"
          >
            Add your first custom domain
          </button>
        </div>
      ) : null}

      {/* Add Domain Form */}
      {showAddForm && canAddDomain && (
        <AddDomainForm onCancel={() => setShowAddForm(false)} />
      )}

      {/* v1 Limit Notice */}
      {hasActiveDomain && (
        <p className="text-xs text-v2-ink-muted">
          You already have an active custom domain. Delete it to add a new one.
        </p>
      )}
      {hasPendingDomain && !hasActiveDomain && (
        <p className="text-xs text-v2-ink-muted">
          Complete or delete your pending domain before adding a new one.
        </p>
      )}
    </div>
  );
}
