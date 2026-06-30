// Load smoke test for the Reels view. Proves ReelsPanel mounts without runtime/loading
// errors and renders its generator form. With imoId undefined the query hooks are disabled
// (enabled: !!imoId), so this needs no network/Supabase mock — it's a pure "does it render"
// check, the cheap counterpart to the (paid) live Vizard integration in
// scripts/validate-vizard-contract.mjs.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReelsPanel } from "../components/ReelsPanel";

function renderPanel(imoId?: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ReelsPanel imoId={imoId} />
    </QueryClientProvider>,
  );
}

describe("ReelsPanel (load smoke)", () => {
  it("mounts with no agency and shows the URL input + a submit button", () => {
    // imoId undefined → useReelJobs is disabled (enabled: !!imoId), so this is a pure render
    // check with zero network. The generator form renders even with no agency / no jobs.
    renderPanel(undefined);
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
