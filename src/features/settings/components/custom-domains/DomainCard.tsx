// Domain Card
// Displays a single custom domain with status and actions

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useVerifyCustomDomain,
  useProvisionCustomDomain,
  useDeleteCustomDomain,
  useCheckDomainStatus,
} from "@/hooks";
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

export function DomainCard({ domain }: DomainCardProps) {
  const [showDns, setShowDns] = useState(domain.status === "pending_dns");
  const [copied, setCopied] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DomainDiagnostics | null>(
    null,
  );

  const verifyDomain = useVerifyCustomDomain();
  const provisionDomain = useProvisionCustomDomain();
  const deleteDomain = useDeleteCustomDomain();
  const checkStatus = useCheckDomainStatus();

  // Polling for provisioning status — extended backoff for SSL provisioning
  // 10s(x1), 20s(x2), 30s(x3), 60s(x5), 120s(x5), 300s(x10) = ~50 min total
  useEffect(() => {
    if (domain.status !== "provisioning") {
      setIsPolling(false);
      setPollCount(0);
      setDiagnostics(null);
      return;
    }

    setIsPolling(true);

    const getInterval = (count: number): number | null => {
      if (count < 1) return 10000; // 10s x1
      if (count < 3) return 20000; // 20s x2
      if (count < 6) return 30000; // 30s x3
      if (count < 11) return 60000; // 60s x5
      if (count < 16) return 120000; // 120s x5
      if (count < 26) return 300000; // 300s x10
      return null; // Stop after ~50 min
    };

    const interval = getInterval(pollCount);
    if (!interval) {
      setIsPolling(false);
      return;
    }

    const timer = setTimeout(() => {
      checkStatus.mutate(domain.id, {
        onSuccess: (data) => {
          setPollCount((c) => c + 1);
          if (data.diagnostics) {
            setDiagnostics(data.diagnostics);
          }
        },
      });
    }, interval);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain.status, pollCount, domain.id]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`https://${domain.hostname}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [domain.hostname]);

  const handleVerify = () => {
    verifyDomain.mutate(domain.id);
  };

  const handleProvision = () => {
    provisionDomain.mutate(domain.id);
  };

  const handleDelete = () => {
    const message =
      domain.status === "provisioning"
        ? `Cancel provisioning and delete ${domain.hostname}? You can re-add it later.`
        : `Are you sure you want to delete ${domain.hostname}? This cannot be undone.`;
    if (window.confirm(message)) {
      deleteDomain.mutate(domain.id);
    }
  };

  const handleRetry = () => {
    // For error state, retry verification
    verifyDomain.mutate(domain.id);
  };

  const handleCheckStatus = () => {
    setPollCount(0);
    checkStatus.mutate(domain.id, {
      onSuccess: (data) => {
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
        }
      },
    });
  };

  const handleRetryProvision = () => {
    provisionDomain.mutate(domain.id);
  };

  const provisioningTimedOut = useMemo(() => {
    if (domain.status !== "provisioning") return false;
    const age = Date.now() - new Date(domain.updated_at).getTime();
    return age > 2 * 60 * 60 * 1000; // 2 hours (matches edge function timeout)
  }, [domain.status, domain.updated_at]);

  const isLoading =
    verifyDomain.isPending ||
    provisionDomain.isPending ||
    deleteDomain.isPending ||
    checkStatus.isPending;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-zinc-900">
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
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
              >
                <ExternalLink className="h-3 w-3" />
                Visit
              </a>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy URL"}
              </button>
            </div>
          )}
        </div>

        {/* Delete button (visible for deletable statuses) */}
        {["draft", "pending_dns", "verified", "provisioning", "error"].includes(
          domain.status,
        ) && (
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            title="Delete domain"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress Indicator - show for in-progress statuses */}
      {domain.status !== "active" && domain.status !== "error" && (
        <div className="mt-2 flex justify-center">
          <DomainProgressIndicator status={domain.status} />
        </div>
      )}

      {/* Error Message */}
      {domain.last_error && (
        <div className="mt-2 flex items-start gap-2 rounded bg-red-50 p-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{domain.last_error}</p>
        </div>
      )}

      {/* DNS Instructions */}
      {(domain.status === "pending_dns" || domain.status === "error") && (
        <div className="mt-3">
          <button
            onClick={() => setShowDns(!showDns)}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            {showDns ? "Hide" : "Show"} DNS Instructions
          </button>
          {showDns && (
            <DnsInstructions
              hostname={domain.hostname}
              verificationToken={domain.verification_token}
              vercelCname={
                domain.provider_metadata &&
                typeof domain.provider_metadata === "object" &&
                "vercel_cname" in domain.provider_metadata
                  ? (domain.provider_metadata as { vercel_cname?: string })
                      .vercel_cname
                  : null
              }
            />
          )}
        </div>
      )}

      {/* Enhanced Provisioning Progress */}
      {domain.status === "provisioning" && (
        <div className="mt-3 space-y-2">
          {provisioningTimedOut ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-amber-800">
                    Provisioning is taking longer than expected
                  </p>
                  <p className="mt-1 text-[10px] text-amber-700">
                    SSL provisioning has exceeded 2 hours. This usually
                    indicates a DNS configuration issue.
                  </p>
                  <button
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="mt-2 flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Cancel & Delete
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-purple-200 bg-purple-50 p-2">
              <div className="flex items-start gap-2">
                <Loader2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 animate-spin text-purple-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-purple-800">
                    Provisioning SSL Certificate
                  </p>
                  <p className="mt-1 text-[10px] text-purple-700">
                    Vercel is generating your SSL certificate. This typically
                    takes <span className="font-medium">1-15 minutes</span> but
                    can take up to 2 hours for new domains.
                  </p>
                  <p className="mt-1.5 text-[10px] text-purple-600">
                    You can leave this page — the process continues in the
                    background.
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Diagnostics panel */}
          {diagnostics && (
            <div className="rounded border border-zinc-200 bg-zinc-50 p-2">
              <p className="text-[10px] font-medium text-zinc-600">
                DNS Diagnostics
              </p>
              <div className="mt-1 space-y-0.5">
                <p className="text-[10px] text-zinc-500">
                  CNAME detected:{" "}
                  <span
                    className={
                      diagnostics.dns_configured
                        ? "font-medium text-green-600"
                        : "font-medium text-amber-600"
                    }
                  >
                    {diagnostics.dns_configured ? "Yes" : "No"}
                  </span>
                </p>
                {diagnostics.cnames_found.length > 0 && (
                  <p className="text-[10px] text-zinc-500">
                    Points to:{" "}
                    <code className="bg-zinc-100 px-0.5">
                      {diagnostics.cnames_found.join(", ")}
                    </code>
                  </p>
                )}
                {diagnostics.misconfigured !== null && (
                  <p className="text-[10px] text-zinc-500">
                    DNS misconfigured:{" "}
                    <span
                      className={
                        diagnostics.misconfigured
                          ? "font-medium text-red-600"
                          : "font-medium text-green-600"
                      }
                    >
                      {diagnostics.misconfigured ? "Yes" : "No"}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            {isPolling ? (
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
                Auto-checking status...
              </span>
            ) : (
              <span className="text-[10px] text-zinc-400">
                Auto-check paused
              </span>
            )}
            <div className="flex items-center gap-2">
              {!provisioningTimedOut && (
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="text-[10px] text-zinc-400 hover:text-zinc-600"
                >
                  Cancel provisioning
                </button>
              )}
              <button
                onClick={handleCheckStatus}
                disabled={isLoading}
                className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3 w-3 ${checkStatus.isPending ? "animate-spin" : ""}`}
                />
                Check Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vercel Verification Requirements */}
      {domain.provider_metadata &&
        typeof domain.provider_metadata === "object" &&
        "verification" in domain.provider_metadata &&
        Array.isArray(
          (domain.provider_metadata as { verification?: unknown[] })
            .verification,
        ) &&
        (domain.provider_metadata as { verification: unknown[] }).verification
          .length > 0 && (
          <div className="mt-2 rounded bg-amber-50 p-2">
            <p className="text-xs font-medium text-amber-700">
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
                <li key={i} className="text-xs text-amber-600">
                  Add {v.type} record:{" "}
                  <code className="bg-amber-100 px-1">{v.domain}</code> →{" "}
                  <code className="bg-amber-100 px-1">{v.value}</code>
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Action Buttons */}
      <div className="mt-3 flex items-center gap-2">
        {domain.status === "pending_dns" && (
          <Button
            size="sm"
            onClick={handleVerify}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            {verifyDomain.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            )}
            Verify DNS
          </Button>
        )}

        {domain.status === "verified" && (
          <Button
            size="sm"
            onClick={handleProvision}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            {provisionDomain.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            Provision Domain
          </Button>
        )}

        {domain.status === "error" && (
          <>
            {domain.verified_at && (
              <Button
                size="sm"
                onClick={handleRetryProvision}
                disabled={isLoading}
                className="h-7 text-xs"
              >
                {provisionDomain.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Retry Provisioning
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              disabled={isLoading}
              className="h-7 text-xs"
            >
              {verifyDomain.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              Retry DNS
            </Button>
          </>
        )}

        {domain.status === "active" && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={isLoading}
            className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            {deleteDomain.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-3 w-3" />
            )}
            Remove Domain
          </Button>
        )}
      </div>

      {/* Verification Result */}
      {verifyDomain.isSuccess && !verifyDomain.data.verified && (
        <div className="mt-2 rounded bg-amber-50 p-2">
          <p className="text-xs text-amber-700">{verifyDomain.data.message}</p>
          {verifyDomain.data.expected_record && (
            <p className="mt-1 text-xs text-amber-600">
              Expected TXT record at:{" "}
              <code className="bg-amber-100 px-1">
                {verifyDomain.data.expected_record.name}
              </code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
