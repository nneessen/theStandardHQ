// src/features/sunset/SunsetPage.tsx
// The neutral, standalone page a revoked user is dropped onto (no app shell,
// no sidebar). Flow: prepare the data export -> download -> confirm -> permanent
// account deletion -> terminal confirmation. Copy is intentionally opaque: it
// never references other tenants or hints the platform continues for anyone.

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  ShieldAlert,
  CheckCircle2,
  FileSpreadsheet,
  FileArchive,
  AlertTriangle,
  Clock,
  ListChecks,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useExportBundle, useDeleteMyAccount } from "@/hooks/imo";
import { AUTO_PURGE_AFTER_DAYS } from "@/constants/revocation";
import { EXPORTED_TABLES } from "../../../supabase/functions/_shared/owned-tables";

// table name -> friendly category label, kept in sync with the export sheets.
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPORTED_TABLES.map((t) => [t.table, t.sheet ?? t.table]),
);

function prettyLabel(table: string): string {
  return (
    CATEGORY_LABELS[table] ??
    table.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Imperative download: fetch the signed URL to a Blob and click an anchor, so
// "has downloaded" only flips after the bytes actually left the bucket (a plain
// <a download> click can't confirm the file ever landed).
async function downloadSignedFile(
  url: string,
  filename: string,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objUrl);
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
    <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-sm">
      {children}
    </div>
  </div>
);

export function SunsetPage() {
  const { signOut } = useAuth();
  const exportBundle = useExportBundle();
  const deleteAccount = useDeleteMyAccount();

  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  // Request the bundle once on mount. The edge fn returns a cron-pre-built
  // bundle instantly (skipIfReady) or builds it on demand.
  useEffect(() => {
    exportBundle.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = exportBundle.data;
  const isReady = result?.status === "ready" && !!result.signedUrls;
  const isPreparing =
    exportBundle.isPending || (!result && !exportBundle.isError);

  const handleDownload = async (key: string, filename: string) => {
    const url = result?.signedUrls?.[key];
    if (!url) return;
    setDownloadingKey(key);
    try {
      await downloadSignedFile(url, filename);
      setHasDownloaded(true);
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloadingKey(null);
    }
  };

  // ── Terminal screen: account permanently deleted ───────────────────────────
  if (deleteAccount.isSuccess) {
    return (
      <Shell>
        <div className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Your account has been permanently deleted
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            All of your data has been removed and cannot be recovered. Thank
            you.
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </Shell>
    );
  }

  const canDelete = isReady && hasDownloaded && confirmChecked;

  return (
    <Shell>
      <div className="p-8">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Access to your account is ending
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Your access is being discontinued. Review everything included in
              your account below and download a copy of your data, then
              permanently close your account. Once your data is deleted, it
              cannot be recovered.
            </p>
          </div>
        </div>

        {/* Auto-purge notice */}
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">
              If you take no action, your account and all of its data will be
              permanently deleted automatically after {AUTO_PURGE_AFTER_DAYS}{" "}
              days.
            </span>{" "}
            You can download your data and close your account now using the
            steps below, or simply do nothing and it will be removed when the{" "}
            {AUTO_PURGE_AFTER_DAYS}-day window ends. Either way, deleted data
            cannot be recovered.
          </span>
        </div>

        {/* Step 1 — review + export */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-800">
            1. Review &amp; download your data
          </h2>

          {isReady && <DataPreview tables={result?.tables} />}

          {isPreparing && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing your data export… this can take a moment.
            </div>
          )}

          {exportBundle.isError && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                We couldn't prepare your export.
              </div>
              <button
                onClick={() => exportBundle.mutate()}
                className="mt-2 inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Try again
              </button>
            </div>
          )}

          {isReady && result?.signedUrls && (
            <div className="mt-3 space-y-2">
              <DownloadRow
                icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
                label="Excel workbook (.xlsx)"
                description="Every record across all your data, one sheet per category."
                busy={downloadingKey === "account-export.xlsx"}
                disabled={!result.signedUrls["account-export.xlsx"]}
                onClick={() =>
                  handleDownload("account-export.xlsx", "account-export.xlsx")
                }
              />
              <DownloadRow
                icon={<FileArchive className="h-4 w-4 text-sky-600" />}
                label="CSV archive (.zip)"
                description="The same data as individual CSV files, plus a manifest."
                busy={downloadingKey === "account-export-csv.zip"}
                disabled={!result.signedUrls["account-export-csv.zip"]}
                onClick={() =>
                  handleDownload(
                    "account-export-csv.zip",
                    "account-export-csv.zip",
                  )
                }
              />
              {hasDownloaded && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Download started —
                  you can now close your account below.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Step 2 — confirm + delete */}
        <section className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-800">
            2. Permanently close your account
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This permanently deletes your account and all of its data. This
            action cannot be undone.
          </p>

          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              disabled={!hasDownloaded}
            />
            <span>
              I have downloaded my data and understand that closing my account
              permanently deletes it.
            </span>
          </label>

          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={!canDelete}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Permanently close my account
            </button>
          ) : (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                Are you absolutely sure? This cannot be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => deleteAccount.mutate()}
                  disabled={deleteAccount.isPending}
                  className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteAccount.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Yes, delete everything
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleteAccount.isPending}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
              {deleteAccount.isError && (
                <p className="mt-2 text-xs text-red-700">
                  {deleteAccount.error?.message ||
                    "Deletion failed. Please try again."}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

// Pre-delete validation: a per-category record-count summary built from the
// export bundle's manifest, so the user can confirm everything is captured
// BEFORE they download or permanently delete.
const DataPreview: React.FC<{ tables?: Record<string, number> }> = ({
  tables,
}) => {
  const { rows, total, emptyCount, errorCount } = useMemo(() => {
    const entries = Object.entries(tables ?? {});
    const rows = entries
      .filter(([, n]) => n > 0)
      .map(([table, n]) => ({ label: prettyLabel(table), count: n }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return {
      rows,
      total: rows.reduce((s, r) => s + r.count, 0),
      emptyCount: entries.filter(([, n]) => n === 0).length,
      errorCount: entries.filter(([, n]) => n < 0).length,
    };
  }, [tables]);

  if (!tables) return null;

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <ListChecks className="h-4 w-4 text-slate-500" />
        What&apos;s included in your export
      </div>

      {rows.length > 0 ? (
        <ul className="mt-2 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between px-3 py-1.5 text-sm"
            >
              <span className="text-slate-700">{r.label}</span>
              <span className="font-medium tabular-nums text-slate-900">
                {r.count.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          No records were found in your account.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs text-slate-500">
        <span>
          <span className="font-medium text-slate-700">
            {total.toLocaleString()}
          </span>{" "}
          record{total === 1 ? "" : "s"} across {rows.length} categor
          {rows.length === 1 ? "y" : "ies"}
        </span>
        {emptyCount > 0 && (
          <span>
            {emptyCount} categor{emptyCount === 1 ? "y has" : "ies have"} no
            records
          </span>
        )}
      </div>

      {errorCount > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          {errorCount} categor{errorCount === 1 ? "y" : "ies"} could not be
          read. Please use “Try again” before downloading.
        </p>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Download the files below to review the full details of every record.
      </p>
    </div>
  );
};

const DownloadRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ icon, label, description, busy, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={busy || disabled}
    className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-60"
  >
    {busy ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : icon}
    <span className="flex-1">
      <span className="block text-sm font-medium text-slate-800">{label}</span>
      <span className="block text-xs text-slate-500">{description}</span>
    </span>
    <Download className="h-4 w-4 text-slate-400" />
  </button>
);
