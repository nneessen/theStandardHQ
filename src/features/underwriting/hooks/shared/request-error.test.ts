import { describe, expect, it } from "vitest";

import {
  createUnderwritingRequestError,
  extractUnderwritingRequestError,
  formatUnderwritingRequestErrorMessage,
  UnderwritingRequestError,
} from "./request-error";

describe("underwriting request error helpers", () => {
  it("extracts code and request id from an edge-function error response", async () => {
    const error = Object.assign(new Error("Transport failed"), {
      context: new Response(
        JSON.stringify({
          code: "evaluation_failed",
          error: "Failed to compute underwriting recommendations",
          requestId: "req-123",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    });

    const parsed = await extractUnderwritingRequestError(
      error,
      "Fallback message",
    );

    expect(parsed).toBeInstanceOf(UnderwritingRequestError);
    expect(parsed.code).toBe("evaluation_failed");
    expect(parsed.status).toBe(500);
    expect(parsed.requestId).toBe("req-123");
    expect(parsed.message).toBe(
      "Failed to compute underwriting recommendations",
    );
  });

  it("formats a request id into the surfaced user message", () => {
    const error = createUnderwritingRequestError(
      {
        error: "Failed to save underwriting session",
        requestId: "req-save-456",
      },
      "Fallback message",
      500,
    );

    expect(
      formatUnderwritingRequestErrorMessage(error, "Fallback message"),
    ).toBe("Failed to save underwriting session Request ID: req-save-456");
  });
});
