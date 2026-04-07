// Tests for the CloseAiBuilderError class — the typed error surface for
// frontend callers. Covers the classification properties the UI relies on
// to render specific handling (rate-limited, feature-locked, not connected).

import { describe, expect, it } from "vitest";
import { CloseAiBuilderError } from "../services/closeAiBuilderService";

describe("CloseAiBuilderError", () => {
  it("carries message, code, status, and closeErrorBody", () => {
    const err = new CloseAiBuilderError("Rate limit hit", {
      code: "RATE_LIMITED",
      status: 429,
      closeErrorBody: { detail: "too many" },
    });
    expect(err.message).toBe("Rate limit hit");
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.status).toBe(429);
    expect(err.closeErrorBody).toEqual({ detail: "too many" });
    expect(err.name).toBe("CloseAiBuilderError");
  });

  it("is an instance of Error (catchable by generic handlers)", () => {
    const err = new CloseAiBuilderError("x");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CloseAiBuilderError);
  });

  it("constructs with only a message", () => {
    const err = new CloseAiBuilderError("basic message");
    expect(err.message).toBe("basic message");
    expect(err.code).toBeUndefined();
    expect(err.status).toBeUndefined();
    expect(err.closeErrorBody).toBeUndefined();
  });

  describe("isRateLimited", () => {
    it("true when code === RATE_LIMITED", () => {
      expect(
        new CloseAiBuilderError("x", { code: "RATE_LIMITED" }).isRateLimited,
      ).toBe(true);
    });
    it("false for other codes", () => {
      expect(
        new CloseAiBuilderError("x", { code: "CLOSE_ERROR" }).isRateLimited,
      ).toBe(false);
      expect(new CloseAiBuilderError("x").isRateLimited).toBe(false);
    });
  });

  describe("isFeatureLocked", () => {
    it("true when code === FEATURE_LOCKED", () => {
      expect(
        new CloseAiBuilderError("x", { code: "FEATURE_LOCKED" })
          .isFeatureLocked,
      ).toBe(true);
    });
    it("false for unrelated codes", () => {
      expect(
        new CloseAiBuilderError("x", { code: "RATE_LIMITED" }).isFeatureLocked,
      ).toBe(false);
    });
  });

  describe("isCloseAuthError", () => {
    it("true when code === CLOSE_AUTH_ERROR (expired Close API key)", () => {
      expect(
        new CloseAiBuilderError("x", { code: "CLOSE_AUTH_ERROR" })
          .isCloseAuthError,
      ).toBe(true);
    });
  });

  describe("isNotConnected", () => {
    it("true when code === CLOSE_NOT_CONNECTED", () => {
      expect(
        new CloseAiBuilderError("x", { code: "CLOSE_NOT_CONNECTED" })
          .isNotConnected,
      ).toBe(true);
    });
    it("true when code === CLOSE_INACTIVE", () => {
      expect(
        new CloseAiBuilderError("x", { code: "CLOSE_INACTIVE" }).isNotConnected,
      ).toBe(true);
    });
    it("false when code is something else", () => {
      expect(
        new CloseAiBuilderError("x", { code: "INTERNAL_ERROR" }).isNotConnected,
      ).toBe(false);
    });
  });
});
