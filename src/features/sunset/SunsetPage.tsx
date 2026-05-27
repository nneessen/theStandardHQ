// src/features/sunset/SunsetPage.tsx
// The neutral, standalone page a revoked user is dropped onto (no app shell,
// no sidebar). Flow: prepare the data export -> download -> confirm -> permanent
// account deletion -> terminal confirmation. Copy is intentionally opaque: it
// never references other tenants or hints the platform continues for anyone.

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  ShieldAlert,
  CheckCircle2,
  FileSpreadsheet,
  FileArchive,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useExportBundle, useDeleteMyAccount } from "@/hooks/imo";

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
              Your access is being discontinued. Please download a copy of your
              data below, then permanently close your account. After your
              account is closed, your data cannot be recovered.
            </p>
          </div>
        </div>

        {/* Step 1 — export */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-800">
            1. Download your data
          </h2>

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
