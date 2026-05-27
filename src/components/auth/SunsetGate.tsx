// src/components/auth/SunsetGate.tsx
// Routes a revoked IMO's non-super-admin users to the neutral sunset page,
// replacing the entire app shell. Must render INSIDE <ImoProvider> (it reads
// useImo()). Wrapped around the authenticated layout in both App.tsx branches.
//
// Ordering is deliberate and safety-critical:
//   1. loading  -> spinner          (don't decide until auth + imo resolve)
//   2. super-admin -> children      (FIRST — the owner lives on the FFG IMO and
//                                    must NEVER be locked out, even when it's
//                                    the revoked IMO)
//   3. revoked  -> <SunsetPage/>    (non-super-admin in an IMO with
//                                    access_revoked_at set)
//   4. else     -> children         (normal app)
//
// `loading` gates on BOTH auth and imo: is_super_admin comes from AuthContext,
// so if imo loading resolved before auth populated the flag, a super-admin could
// briefly hit the revoked branch. Gating on both removes that race.

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRevocationStatus } from "@/hooks/imo";
import { SunsetPage } from "@/features/sunset";

export function SunsetGate({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth();
  // isRevoked already encodes the super-admin-first rule: it is `!isSuperAdmin &&
  // access_revoked_at != null`, so a super-admin (even on the revoked FFG IMO)
  // gets isRevoked=false and falls through to children — never locked out.
  const { loading: imoLoading, isRevoked } = useRevocationStatus();

  if (authLoading || imoLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-lg text-slate-500">Loading…</div>
      </div>
    );
  }

  if (isRevoked) return <SunsetPage />;

  return <>{children}</>;
}
