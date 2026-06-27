// Interaction (write-path) tests for the photo move/zoom controls. The export-render
// harness proves the READ path (config → card → PNG); these prove the part the harness
// can't: that dragging the overlay, moving the zoom slider, and scrolling actually call
// back with the right values — for ANY photo-bearing card, not just AOTW.

import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { SocialPreview, type PreviewData } from "../components/SocialPreview";

beforeAll(() => {
  // jsdom doesn't implement pointer capture; the drag overlay calls it on pointerdown.
  if (!Element.prototype.setPointerCapture)
    Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture)
    Element.prototype.releasePointerCapture = () => {};
});

const AOTW: PreviewData = {
  kind: "aotw",
  periodLabel: "WEEK OF JUN 14–20",
  design: "aurora",
  theme: "spotlight",
  agent: {
    name: "Marcus W.",
    ap: 18600,
    policies: 15,
    photoUrl: "data:image/x",
  },
  photoPosition: "50% 50%",
  photoScale: 1,
};

const NEWAGENT: PreviewData = {
  kind: "newagent",
  agent: { name: "Jordan A.", photoUrl: "data:image/x" },
  photoPosition: "50% 50%",
  photoScale: 1,
  variant: "celebration",
  theme: "spotlight",
};

function renderPreview(
  over: Partial<React.ComponentProps<typeof SocialPreview>> = {},
) {
  const onPhotoPositionChange = vi.fn();
  const onPhotoScaleChange = vi.fn();
  const utils = render(
    <SocialPreview
      data={AOTW}
      format="portrait"
      agencyName="THE STANDARD"
      network="EPIC LIFE"
      isSample={false}
      isLoading={false}
      showPolicies
      repositionable
      photoPosition="50% 50%"
      photoScale={1}
      onPhotoPositionChange={onPhotoPositionChange}
      onPhotoScaleChange={onPhotoScaleChange}
      {...over}
    />,
  );
  const overlay = () =>
    utils.container.querySelector(
      '[title*="Drag to reposition"]',
    ) as HTMLElement | null;
  return { ...utils, overlay, onPhotoPositionChange, onPhotoScaleChange };
}

describe("SocialPreview photo move/zoom interaction", () => {
  it("commits a new scale when the zoom slider moves", () => {
    const { onPhotoScaleChange } = renderPreview();
    fireEvent.change(screen.getByLabelText("Zoom photo"), {
      target: { value: "2.4" },
    });
    expect(onPhotoScaleChange).toHaveBeenCalledWith(2.4);
  });

  it("pans the focal point on drag (grab-and-move: dragging right drops x%)", () => {
    const { overlay, onPhotoPositionChange } = renderPreview();
    const el = overlay();
    expect(el).toBeTruthy();
    fireEvent.pointerDown(el!, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(el!, { clientX: 120, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(el!, { clientX: 120, clientY: 0, pointerId: 1 });
    expect(onPhotoPositionChange).toHaveBeenCalledTimes(1);
    const pos = onPhotoPositionChange.mock.calls[0][0] as string;
    const x = Number(pos.match(/(-?\d+)%/)![1]);
    expect(x).toBeLessThan(50); // dragging right reveals the image's left → x% decreases
    expect(pos).toMatch(/ 50%$/); // purely horizontal drag → y stays centered
  });

  it("zooms in on scroll-up over the photo (wheel)", () => {
    const { overlay, onPhotoScaleChange } = renderPreview();
    fireEvent.wheel(overlay()!, { deltaY: -120 });
    expect(onPhotoScaleChange).toHaveBeenCalled();
    expect(onPhotoScaleChange.mock.calls[0][0]).toBeGreaterThan(1);
  });

  it("resets zoom to 1 via the reset button when zoomed", () => {
    const { onPhotoScaleChange } = renderPreview({ photoScale: 2 });
    fireEvent.click(screen.getByTitle("Reset zoom to 100%"));
    expect(onPhotoScaleChange).toHaveBeenCalledWith(1);
  });

  it("enables move + zoom for the new-agent welcome card too, not just AOTW", () => {
    const { overlay, onPhotoPositionChange } = renderPreview({
      data: NEWAGENT,
    });
    expect(screen.getByLabelText("Zoom photo")).toBeTruthy();
    const el = overlay();
    expect(el).toBeTruthy();
    fireEvent.pointerDown(el!, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(el!, { clientX: 50, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(el!, { clientX: 50, clientY: 0, pointerId: 1 });
    expect(onPhotoPositionChange).toHaveBeenCalledTimes(1);
    // dragging up reveals the image's bottom → y% increases above center
    const pos = onPhotoPositionChange.mock.calls[0][0] as string;
    const y = Number(pos.match(/% (-?\d+)%/)![1]);
    expect(y).toBeGreaterThan(50);
  });

  it("hides the move/zoom controls when not repositionable", () => {
    const { overlay } = renderPreview({ repositionable: false });
    expect(screen.queryByLabelText("Zoom photo")).toBeNull();
    expect(overlay()).toBeNull();
  });
});
