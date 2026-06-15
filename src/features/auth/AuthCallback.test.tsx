// src/features/auth/AuthCallback.test.tsx
//
// Regression coverage for the password-reset dead-end bug.
//
// Supabase OMITS the `type` param on error redirects (expired / superseded /
// already-used recovery links). The old gate only routed errors to the retry
// form when `type === "recovery"`, so a failed reset link dead-ended on the
// generic "Verification Failed" page with no way forward. These tests pin the
// fixed behavior: an error with NO type — in the hash OR the query string —
// must route to /auth/reset-password?error=true so the user gets the retry form.

import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCallback } from "./AuthCallback";
import { SESSION_STORAGE_KEYS } from "../../constants/auth.constants";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../services/base/supabase", () => ({
  supabase: { auth: { setSession: vi.fn() } },
}));

vi.mock("../../services/base/logger", () => ({
  logger: { auth: vi.fn(), error: vi.fn() },
}));

let hrefSetter: ReturnType<typeof vi.fn>;

function setLocation({
  hash = "",
  search = "",
}: {
  hash?: string;
  search?: string;
}) {
  hrefSetter = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      hash,
      search,
      get href() {
        return "http://localhost/auth/callback";
      },
      set href(v: string) {
        hrefSetter(v);
      },
    },
  });
}

describe("AuthCallback — recovery error routing", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes a recovery error with NO type (hash) to the reset-password retry form", async () => {
    setLocation({
      hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    });

    render(<AuthCallback />);

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith(
        "/auth/reset-password?error=true",
      );
    });

    const stored = sessionStorage.getItem(
      SESSION_STORAGE_KEYS.PASSWORD_RESET_ERROR,
    );
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string).code).toBe("otp_expired");
  });

  it("routes a recovery error arriving in the QUERY STRING to the retry form", async () => {
    setLocation({
      search:
        "?error=access_denied&error_code=otp_expired&error_description=expired",
    });

    render(<AuthCallback />);

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith(
        "/auth/reset-password?error=true",
      );
    });
    expect(
      sessionStorage.getItem(SESSION_STORAGE_KEYS.PASSWORD_RESET_ERROR),
    ).toBeTruthy();
  });

  it("still routes an explicit type=recovery error to the retry form", async () => {
    setLocation({
      hash: "#error=access_denied&error_code=otp_expired&type=recovery&error_description=expired",
    });

    render(<AuthCallback />);

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith(
        "/auth/reset-password?error=true",
      );
    });
  });
});
