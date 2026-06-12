import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let authState: { loading: boolean };
let revocationState: { loading: boolean; isRevoked: boolean };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));
vi.mock("@/hooks/imo", () => ({
  useRevocationStatus: () => revocationState,
}));
vi.mock("@/features/sunset", () => ({
  AccountClosedNotice: () => <div>ACCOUNT_CLOSED</div>,
}));

import { SunsetGate } from "./SunsetGate";

function renderGate() {
  return render(
    <SunsetGate>
      <div>APP_SHELL</div>
    </SunsetGate>,
  );
}

describe("SunsetGate", () => {
  beforeEach(() => {
    authState = { loading: false };
    revocationState = { loading: false, isRevoked: false };
  });

  it("shows a spinner while auth or imo is still loading", () => {
    authState = { loading: true };
    renderGate();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("APP_SHELL")).not.toBeInTheDocument();
    expect(screen.queryByText("ACCOUNT_CLOSED")).not.toBeInTheDocument();
  });

  it("routes a revoked user to the account-closed notice instead of the app shell", () => {
    revocationState = { loading: false, isRevoked: true };
    renderGate();
    expect(screen.getByText("ACCOUNT_CLOSED")).toBeInTheDocument();
    expect(screen.queryByText("APP_SHELL")).not.toBeInTheDocument();
  });

  it("renders the app shell for a non-revoked user", () => {
    renderGate();
    expect(screen.getByText("APP_SHELL")).toBeInTheDocument();
    expect(screen.queryByText("ACCOUNT_CLOSED")).not.toBeInTheDocument();
  });
});
