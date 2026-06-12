// src/features/sunset/AccountClosedNotice.tsx
// The permanent, standalone terminal screen shown when a user's IMO has been
// revoked (the platform-sunset hard block). It replaces the former grace-period
// "Access to your account is ending" page: the grace/export/self-delete window
// is over, so this is now a flat, final "account closed" notice.
//
// Two entry points, both render this same screen:
//   1. Login (a blocked sign-in attempt) — the session is already torn down.
//   2. SunsetGate (a lingering authenticated session) — still holds a JWT, but
//      RLS denies all data; "Back to home" signs out and returns to the public
//      landing page.
//
// Copy is intentionally opaque: it never references other tenants or hints that
// the platform continues for anyone else.

import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function AccountClosedNotice() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleHome = async () => {
    // Tear down any lingering session (no-op if already signed out at login),
    // then drop the user on the public landing page.
    try {
      await signOut();
    } catch {
      // ignore — navigation home is what matters
    }
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-6 w-6 text-slate-500" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Account closed
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This account has been closed and is no longer accessible.
          </p>
          <button
            onClick={() => void handleHome()}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
