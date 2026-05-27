// src/hooks/imo/useRevocation.ts
// Hooks for the platform-sunset / IMO-access-revocation flow.
//
// Self-side (revoked user on the sunset page):
//   useRevocationStatus   — am I revoked? (derived from ImoContext)
//   useExportBundle        — request/poll the data-export bundle (signed URLs)
//   useDeleteMyAccount     — confirm + permanently wipe, then sign out
//
// Admin-side (super-admin RED BUTTON):
//   useRevocationAdminStatus — FFG status + users-remaining + purge deadline
//   useActivateRevocation / useDeactivateRevocation — flip Switch A
//
// All destructive/activation calls go through the edge functions; nothing here
// touches Stripe. The export/wipe edge functions read via service-role, so a
// revoked user's gate-denied JWT still drives them through invoke().

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base";
import { useImo } from "@/contexts/ImoContext";
import { FFG_IMO_ID } from "@/constants/imos";
import { AUTO_PURGE_AFTER_DAYS } from "@/constants/revocation";

export const revocationKeys = {
  adminStatus: ["revocation", "admin-status"] as const,
};

// ── Self: am I revoked? ──────────────────────────────────────────────────────
export interface RevocationStatus {
  loading: boolean;
  isSuperAdmin: boolean;
  /** true only for a non-super-admin whose IMO has access_revoked_at set */
  isRevoked: boolean;
  imoName: string | null;
  revokedAt: string | null;
}

export function useRevocationStatus(): RevocationStatus {
  const { imo, isSuperAdmin, loading } = useImo();
  const revokedAt = imo?.access_revoked_at ?? null;
  return {
    loading,
    isSuperAdmin,
    isRevoked: !isSuperAdmin && revokedAt != null,
    imoName: imo?.name ?? null,
    revokedAt,
  };
}

// ── Self: the export bundle ──────────────────────────────────────────────────
export interface ExportBundleResult {
  status: "ready" | "generating" | "failed";
  exportLogId?: string;
  storagePath?: string;
  signedUrls?: Record<string, string | null>;
  reused?: boolean;
  error?: string;
}

/**
 * Requests the user's export bundle. `skipIfReady` lets the edge function return
 * a cron-pre-built bundle's signed URLs instantly instead of rebuilding it.
 */
export function useExportBundle() {
  return useMutation<ExportBundleResult, Error>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "generate-user-export-bundle",
        { body: { skipIfReady: true } },
      );
      if (error) throw new Error(error.message);
      const result = data as ExportBundleResult;
      if (result.status === "failed") {
        throw new Error(result.error || "Export generation failed");
      }
      return result;
    },
  });
}

// ── Self: permanent account deletion ─────────────────────────────────────────
/**
 * Confirms and permanently wipes the caller's account. IRREVERSIBLE. On success
 * it purges every client cache/storage trace, but it does NOT sign out — the
 * terminal confirmation screen owns the explicit sign-out, otherwise the auth
 * redirect would unmount the screen before the user sees it.
 */
export function useDeleteMyAccount() {
  const queryClient = useQueryClient();

  return useMutation<{ status: string }, Error>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "confirm-and-wipe-account",
        { body: {} }, // self: userId is forced to the caller server-side
      );
      if (error) throw new Error(error.message);
      const result = data as { status: string; error?: string };
      if (result.status === "failed") {
        throw new Error(result.error || "Account deletion failed");
      }
      return result;
    },
    onSuccess: () => {
      // The account no longer exists — purge every client trace. signOut is
      // deferred to the terminal screen's explicit action.
      queryClient.clear();
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // storage unavailable (private mode) — the terminal screen still renders
      }
    },
  });
}

// ── Admin: RED BUTTON status ─────────────────────────────────────────────────
export interface RevocationAdminStatus {
  imoId: string;
  imoName: string;
  revokedAt: string | null;
  isRevoked: boolean;
  usersRemaining: number;
  purgeDeadline: string | null; // revokedAt + AUTO_PURGE_AFTER_DAYS
}

export function useRevocationAdminStatus(enabled: boolean) {
  return useQuery<RevocationAdminStatus>({
    queryKey: revocationKeys.adminStatus,
    enabled,
    queryFn: async () => {
      const { data: imo, error: imoErr } = await supabase
        .from("imos")
        .select("id, name, access_revoked_at")
        .eq("id", FFG_IMO_ID)
        .single();
      if (imoErr) throw new Error(imoErr.message);

      const { count, error: cntErr } = await supabase
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("imo_id", FFG_IMO_ID)
        .or("is_super_admin.is.null,is_super_admin.eq.false");
      if (cntErr) throw new Error(cntErr.message);

      const revokedAt = imo.access_revoked_at ?? null;
      const purgeDeadline = revokedAt
        ? new Date(
            new Date(revokedAt).getTime() +
              AUTO_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString()
        : null;

      return {
        imoId: imo.id,
        imoName: imo.name,
        revokedAt,
        isRevoked: revokedAt != null,
        usersRemaining: count ?? 0,
        purgeDeadline,
      };
    },
  });
}

// ── Admin: flip Switch A ─────────────────────────────────────────────────────
export function useActivateRevocation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { confirmText: string }>({
    mutationFn: async ({ confirmText }) => {
      const { data, error } = await supabase.functions.invoke(
        "activate-imo-revocation",
        { body: { imoId: FFG_IMO_ID, action: "revoke", confirmText } },
      );
      if (error) throw new Error(error.message);
      const result = data as { error?: string; status?: string };
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: revocationKeys.adminStatus }),
  });
}

export function useDeactivateRevocation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "activate-imo-revocation",
        { body: { imoId: FFG_IMO_ID, action: "restore" } },
      );
      if (error) throw new Error(error.message);
      const result = data as { error?: string; status?: string };
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: revocationKeys.adminStatus }),
  });
}
