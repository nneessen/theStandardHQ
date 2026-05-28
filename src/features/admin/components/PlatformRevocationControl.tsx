// src/features/admin/components/PlatformRevocationControl.tsx
// Super-admin "RED BUTTON": revoke (or restore) platform access for the FFG /
// Self Made IMO. Switch A only — reversible. The irreversible per-user wipe is
// driven from each user's sunset page / the day-7 auto-purge, never from here.
//
// Revoke is double-confirmed: the operator must type `REVOKE <imo name>` exactly.
// Restore is single-confirm. Stripe is handled MANUALLY by the owner in the
// Stripe dashboard AFTER pressing this — never from here.

import { useState } from "react";
import {
  ShieldAlert,
  Power,
  RotateCcw,
  Loader2,
  Users,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { useImo } from "@/contexts/ImoContext";
import {
  useRevocationAdminStatus,
  useActivateRevocation,
  useDeactivateRevocation,
} from "@/hooks/imo";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PlatformRevocationControl() {
  const { isSuperAdmin } = useImo();
  const { data: status, isLoading } = useRevocationAdminStatus(isSuperAdmin);
  const activate = useActivateRevocation();
  const deactivate = useDeactivateRevocation();

  const [confirmText, setConfirmText] = useState("");
  const [showRestore, setShowRestore] = useState(false);

  // Hard gate: never render for non-super-admins.
  if (!isSuperAdmin) return null;

  if (isLoading || !status) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-v2-line bg-v2-surface px-3 py-4 text-xs text-v2-ink-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading platform
        status…
      </div>
    );
  }

  const expectedConfirm = `REVOKE ${status.imoName}`;
  const canRevoke = confirmText === expectedConfirm && !activate.isPending;

  const handleRevoke = () => {
    activate.mutate(
      { confirmText },
      {
        onSuccess: () => {
          toast.success(`Access revoked for ${status.imoName}.`);
          setConfirmText("");
        },
        onError: (e) => toast.error(e.message || "Revoke failed"),
      },
    );
  };

  const handleRestore = () => {
    deactivate.mutate(undefined, {
      onSuccess: () => {
        toast.success(`Access restored for ${status.imoName}.`);
        setShowRestore(false);
      },
      onError: (e) => toast.error(e.message || "Restore failed"),
    });
  };

  return (
    <div className="rounded-md border border-red-300 bg-red-50/60">
      <div className="border-b border-red-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-semibold text-red-800">
            Platform Access — {status.imoName}
          </h3>
        </div>
        <p className="mt-1 text-[11px] text-red-700/80">
          Revoking locks every non-super-admin user in this organization out of
          the platform and routes them to the data-export &amp; account-closure
          page. You are never locked out. After revoking, cancel any
          subscriptions manually in Stripe — never before.
        </p>
      </div>

      <div className="px-4 py-3">
        {status.isRevoked ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <Stat
                icon={<Power className="h-3.5 w-3.5 text-red-600" />}
                label="Revoked since"
                value={fmt(status.revokedAt)}
              />
              <Stat
                icon={<Users className="h-3.5 w-3.5 text-red-600" />}
                label="Users remaining"
                value={String(status.usersRemaining)}
              />
              <Stat
                icon={<CalendarClock className="h-3.5 w-3.5 text-red-600" />}
                label="Auto-purge by"
                value={fmt(status.purgeDeadline)}
              />
            </div>

            {!showRestore ? (
              <button
                onClick={() => setShowRestore(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restore access…
              </button>
            ) : (
              <div className="mt-4 rounded-md border border-slate-300 bg-white p-3">
                <p className="text-xs text-slate-700">
                  Restore platform access for <strong>{status.imoName}</strong>?
                  Users who have already deleted their accounts are not
                  affected.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleRestore}
                    disabled={deactivate.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {deactivate.isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Confirm restore
                  </button>
                  <button
                    onClick={() => setShowRestore(false)}
                    disabled={deactivate.isPending}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Access is <strong>active</strong>. {status.usersRemaining} user
              {status.usersRemaining === 1 ? "" : "s"} in this organization.
            </div>

            <label className="mt-3 block text-xs font-medium text-red-800">
              To revoke, type{" "}
              <code className="rounded bg-red-100 px-1 py-0.5 text-red-900">
                {expectedConfirm}
              </code>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedConfirm}
              autoComplete="off"
              className="mt-1.5 w-full max-w-sm rounded-md border border-red-300 px-2.5 py-1.5 text-xs focus:border-red-500 focus:outline-none"
            />
            <div className="mt-3">
              <button
                onClick={handleRevoke}
                disabled={!canRevoke}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white enabled:hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {activate.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Power className="h-3.5 w-3.5" />
                )}
                Revoke platform access
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const Stat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="rounded-md border border-red-200 bg-white px-2.5 py-2">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
      {icon}
      {label}
    </div>
    <div className="mt-0.5 text-xs font-semibold text-slate-800">{value}</div>
  </div>
);
