import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ConnectionCard } from "./ConnectionCard";

describe("ConnectionCard", () => {
  it("renders an unavailable state instead of not connected", () => {
    render(
      <ConnectionCard
        title="Close CRM"
        icon={<span>CRM</span>}
        connected={false}
        state="unavailable"
        unavailableLabel="We could not verify your Close CRM connection right now."
        onConnect={vi.fn()}
      />,
    );

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We could not verify your Close CRM connection right now.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Not Connected")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect" }),
    ).not.toBeInTheDocument();
  });
});
