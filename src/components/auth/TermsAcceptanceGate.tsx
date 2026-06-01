// src/components/auth/TermsAcceptanceGate.tsx
//
// First-login clickwrap gate. Account access is invitation-only (admins/uplines
// create users), but an invitation is not assent — so before any user reaches
// the app we require an AFFIRMATIVE, recorded acceptance of the current Terms of
// Service & Privacy Policy. This is what makes the arbitration clause and
// class-action waiver in the Terms (section 13) enforceable.
//
// Placement: rendered inside ApprovalGuard, so it wraps every authenticated
// surface (board, recruit pipeline, command center) in one place and only fires
// for users who are already approved to use the app.
//
// The "accepted" answer lives in the global query cache (see
// useTermsAcceptanceStatus), so it survives this component remounting when the
// user navigates between layout branches — no re-prompt after acceptance.

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAcceptTerms,
  useTermsAcceptanceStatus,
} from "@/hooks/legal";

export function TermsAcceptanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const isSuperAdmin = Boolean(user?.is_super_admin);

  // The platform owner is never blocked by their own gate (mirrors SunsetGate).
  const { data, isLoading } = useTermsAcceptanceStatus(userId, !isSuperAdmin);

  // Owner / no-user / still-resolving: never hold the app hostage. For the brief
  // resolving window a not-yet-accepted user may see the app for a moment before
  // the modal replaces it — acceptable, and it self-corrects the instant the
  // query resolves.
  if (isSuperAdmin || !userId || isLoading) return <>{children}</>;
  if (data?.terms_accepted_at) return <>{children}</>;

  return <TermsAcceptanceModal userId={userId} />;
}

function TermsAcceptanceModal({ userId }: { userId: string }) {
  const { signOut } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const accept = useAcceptTerms(userId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0a0a0b] px-4 py-8"
    >
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#131316] p-6 sm:p-8 shadow-2xl">
        <h1
          id="terms-gate-title"
          className="text-lg font-semibold text-white"
        >
          Before you continue
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          To use The Standard HQ, please review and accept our Terms of Service
          and Privacy Policy. These govern your use of the platform, including
          how your data is handled and how disputes are resolved.
        </p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-400 underline underline-offset-2 hover:text-sky-300"
          >
            Read the Terms of Service
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-400 underline underline-offset-2 hover:text-sky-300"
          >
            Read the Privacy Policy
          </a>
          <a
            href="/accessibility"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-400 underline underline-offset-2 hover:text-sky-300"
          >
            Accessibility
          </a>
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-white/85">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 bg-transparent accent-sky-500"
          />
          <span>
            I have read and agree to the Terms of Service and Privacy Policy.
          </span>
        </label>

        {accept.isError && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-400"
          >
            Something went wrong recording your acceptance. Please try again.
          </p>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white/60 hover:text-white/90"
          >
            Decline &amp; sign out
          </button>
          <button
            type="button"
            disabled={!agreed || accept.isPending}
            onClick={() => accept.mutate()}
            className="rounded-md bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {accept.isPending ? "Saving…" : "Agree & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
