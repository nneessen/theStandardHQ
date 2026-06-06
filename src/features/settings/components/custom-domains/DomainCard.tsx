// Domain Card
// Displays a single custom domain with status and actions.
//
// Simplified flow: the domain is registered with Vercel at create time, the user
// adds ONE CNAME, and we auto-poll until it goes live. There are no manual
// "Verify DNS" / "Provision" steps.

import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeleteCustomDomain, useCheckDomainStatus } from "@/hooks";
import { DnsInstructions } from "./DnsInstructions";
import { DomainProgressIndicator } from "./DomainProgressIndicator";
import type {
  CustomDomain,
  DomainDiagnostics,
} from "@/types/custom-domain.types";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/custom-domain.types";

interface DomainCardProps {
  domain: CustomDomain;
}

/** True while the domain is still working toward "active". */
function isInProgress(status: CustomDomain["status"]): boolean {
  return status === "pending_dns" || status === "provisioning";
}

function getVercelCname(domain: CustomDomain): string | null {
  const meta = domain.provider_metadata;
  if (meta && typeof meta === "object" && "vercel_cname" in meta) {
    return (meta as { vercel_cname?: string }).vercel_cname ?? null;
  }
  return null;
}

export function DomainCard({ domain }: DomainCardProps) {
  const [copied, setCopied] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DomainDiagnostics | null>(
    null,
  );

  const deleteDomain = useDeleteCustomDomain();
  const checkStatus = useCheckDomainStatus();

  // Auto-poll every 60s while waiting on DNS or SSL. The domain auto-advances
  // (pending_dns -> provisioning -> active) on the server; we just refresh.
  useEffect(() => {
    if (!isInProgress(domain.status)) {
      setDiagnostics(null);
      return;
    }

    const timer = setInterval(() => {
      checkStatus.mutate(domain.id, {
        onSuccess: (data) => {
          if (data.diagnostics) setDiagnostics(data.diagnostics);
        },
      });
    }, 60000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain.status, domain.id]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`https://${domain.hostname}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [domain.hostname]);

  const handleDelete = () => {
    const message = isInProgress(domain.status)
      ? `Stop setup and delete ${domain.hostname}? You can re-add it later.`
      : `Are you sure you want to delete ${domain.hostname}? This cannot be undone.`;
    if (window.confirm(message)) {
      deleteDomain.mutate(domain.id);
    }
  };

  const handleCheckStatus = () => {
    checkStatus.mutate(domain.id, {
      onSuccess: (data) => {
        if (data.diagnostics) setDiagnostics(data.diagnostics);
      },
    });
  };

  const isLoading = deleteDomain.isPending || checkStatus.isPending;

  return (
    <div className="rounded-md border border-v2-ring bg-v2-card p-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-v2-ink">
              {domain.hostname}
            </span>
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[domain.status]}`}
            >
              {STATUS_LABELS[domain.status]}
            </span>
          </div>

          {domain.status === "active" && (
            <div className="mt-1 flex items-center gap-2">
              <a
                href={`https://${domain.hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-v2-ink-muted hover:text-v2-ink"
              >
                <ExternalLink className="h-3 w-3" />
                Visit
              </a>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-v2-ink-muted hover:text-v2-ink"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy URL"}
              </button>
            </div>
          )}
        </div>

        {/* Delete button (visible for every deletable status) */}
        <button
          onClick={handleDelete}
          disabled={isLoading}
          className="rounded p-1 text-v2-ink-subtle hover:bg-v2-ring hover:text-v2-ink-muted"
          title="Delete domain"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Indicator - show for in-progress statuses */}
      {isInProgress(domain.status) && (
        <div className="mt-2 flex justify-center">
          <DomainProgressIndicator status={domain.status} />
        </div>
      )}

      {/* Error Message */}
      {domain.last_error && (
        <div className="mt-2 flex items-start gap-2 rounded bg-destructive/10 p-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{domain.last_error}</p>
        </div>
      )}

      {/* DNS Instructions — the single CNAME the user must add */}
      {(domain.status === "pending_dns" || domain.status === "error") && (
        <div className="mt-3">
          <DnsInstructions
            hostname={domain.hostname}
            vercelCname={getVercelCname(domain)}
          />
        </div>
      )}

      {/* Provisioning (SSL issuing) */}
      {domain.status === "provisioning" && (
        <div className="mt-3 space-y-2">
          <div className="rounded-md border border-info/30 bg-info/10 p-2">
            <div className="flex items-start gap-2">
              <Loader2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 animate-spin text-info" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-info">
                  Issuing SSL Certificate
                </p>
                <p className="mt-1 text-[10px] text-info">
                  DNS detected. Vercel is generating your SSL certificate — this
                  usually takes{" "}
                  <span className="font-medium">1–15 minutes</span>. You can
                  leave this page; it finishes in the background.
                </p>
              </div>
            </div>
          </div>
          {diagnostics && <DiagnosticsPanel diagnostics={diagnostics} />}
        </div>
      )}

      {/* Vercel Verification Requirements (only when the domain is in use
          elsewhere and Vercel demands an extra record) */}
      {domain.provider_metadata &&
        typeof domain.provider_metadata === "object" &&
        "verification" in domain.provider_metadata &&
        Array.isArray(
          (domain.provider_metadata as { verification?: unknown[] })
            .verification,
        ) &&
        (domain.provider_metadata as { verification: unknown[] }).verification
          .length > 0 && (
          <div className="mt-2 rounded bg-warning/10 p-2">
            <p className="text-xs font-medium text-warning">
              Vercel requires additional verification:
            </p>
            <ul className="mt-1 space-y-1">
              {(
                domain.provider_metadata as {
                  verification: Array<{
                    type: string;
                    domain: string;
                    value: string;
                  }>;
                }
              ).verification.map((v, i) => (
                <li key={i} className="text-xs text-warning">
                  Add {v.type} record:{" "}
                  <code className="bg-warning/20 px-1">{v.domain}</code> →{" "}
                  <code className="bg-warning/20 px-1">{v.value}</code>
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Status footer for in-progress domains */}
      {isInProgress(domain.status) && (
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] text-v2-ink-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info" />
            Checking automatically every minute…
          </span>
          <button
            onClick={handleCheckStatus}
            disabled={isLoading}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-v2-ink-muted hover:bg-v2-ring hover:text-v2-ink disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${checkStatus.isPending ? "animate-spin" : ""}`}
            />
            Check now
          </button>
        </div>
      )}

      {/* Remove button for active domains */}
      {domain.status === "active" && (
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={isLoading}
            className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {deleteDomain.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-3 w-3" />
            )}
            Remove Domain
          </Button>
        </div>
      )}
    </div>
  );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: DomainDiagnostics }) {
  return (
    <div className="rounded border border-v2-ring bg-v2-canvas p-2">
      <p className="text-[10px] font-medium text-v2-ink-muted">
        DNS Diagnostics
      </p>
      <div className="mt-1 space-y-0.5">
        <p className="text-[10px] text-v2-ink-muted">
          CNAME detected:{" "}
          <span
            className={
              diagnostics.dns_configured
                ? "font-medium text-success"
                : "font-medium text-warning"
            }
          >
            {diagnostics.dns_configured ? "Yes" : "No"}
          </span>
        </p>
        {diagnostics.cnames_found.length > 0 && (
          <p className="text-[10px] text-v2-ink-muted">
            Points to:{" "}
            <code className="bg-v2-ring px-0.5">
              {diagnostics.cnames_found.join(", ")}
            </code>
          </p>
        )}
        {diagnostics.misconfigured !== null && (
          <p className="text-[10px] text-v2-ink-muted">
            DNS misconfigured:{" "}
            <span
              className={
                diagnostics.misconfigured
                  ? "font-medium text-destructive"
                  : "font-medium text-success"
              }
            >
              {diagnostics.misconfigured ? "Yes" : "No"}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
