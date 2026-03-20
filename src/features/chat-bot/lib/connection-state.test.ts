import { describe, expect, it } from "vitest";

import {
  getConnectionStateLabel,
  resolveConnectionState,
} from "./connection-state";

describe("connection-state", () => {
  it("returns connected when the connection is verified", () => {
    expect(resolveConnectionState({ connected: true })).toBe("connected");
  });

  it("returns disconnected when no connection is present", () => {
    expect(resolveConnectionState({ connected: false })).toBe("disconnected");
  });

  it("returns unavailable for service failures instead of disconnected", () => {
    expect(
      resolveConnectionState({
        connected: false,
        error: { isServiceError: true },
      }),
    ).toBe("unavailable");
  });

  it("maps labels by connection state", () => {
    expect(
      getConnectionStateLabel("unavailable", {
        connected: "Connected",
        disconnected: "Not connected",
        unavailable: "Status unavailable",
      }),
    ).toBe("Status unavailable");
  });
});
