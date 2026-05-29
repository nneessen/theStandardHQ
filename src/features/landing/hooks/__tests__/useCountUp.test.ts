import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountUp } from "../useCountUp";

// Drive requestAnimationFrame manually so we control the animation clock.
let rafCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  rafCallbacks = [];
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function flushFrame(ts: number) {
  const callbacks = rafCallbacks;
  rafCallbacks = [];
  act(() => {
    callbacks.forEach((cb) => cb(ts));
  });
}

// Drives the animation to completion regardless of duration: each frame jumps
// well past any test duration so the second frame's elapsed exceeds it, landing
// on the exact `end` value.
function runAnimation() {
  let ts = 0;
  let guard = 0;
  while (rafCallbacks.length > 0 && guard < 100) {
    ts += 10_000;
    flushFrame(ts);
    guard += 1;
  }
}

describe("useCountUp", () => {
  it("animates from start to a static end value", () => {
    const { result } = renderHook(() => useCountUp(1000, { duration: 100 }));
    expect(result.current.value).toBe(0);
    runAnimation();
    expect(result.current.value).toBe(1000);
  });

  it("re-animates to a value that arrives asynchronously after mount (regression: async end stuck at 0)", () => {
    // Mirrors the command-center Production hero: the value is 0 until data loads.
    const { result, rerender } = renderHook(
      ({ end }) => useCountUp(end, { duration: 100 }),
      { initialProps: { end: 0 } },
    );

    // First render with end=0 is a no-op (already at target).
    runAnimation();
    expect(result.current.value).toBe(0);

    // Async data arrives — end changes to a real value.
    rerender({ end: 628828 });
    runAnimation();

    // Before the fix the one-shot guard left this frozen at 0.
    expect(result.current.value).toBe(628828);
  });

  it("eases from the current displayed value when end changes mid-life", () => {
    const { result, rerender } = renderHook(
      ({ end }) => useCountUp(end, { duration: 100 }),
      { initialProps: { end: 100 } },
    );
    runAnimation();
    expect(result.current.value).toBe(100);

    rerender({ end: 200 });
    runAnimation();
    expect(result.current.value).toBe(200);
  });
});
