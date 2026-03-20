import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeadStatusSelector } from "./LeadStatusSelector";

describe("LeadStatusSelector", () => {
  it("renders live Close status options when provided", () => {
    render(
      <LeadStatusSelector
        selected={[]}
        onChange={vi.fn()}
        options={[
          { id: "stat_reschedule", label: "Contacted/Reschedule" },
          { id: "stat_missed", label: "Contacted/Missed Appointment" },
        ]}
      />,
    );

    expect(screen.getByText("Contacted/Reschedule")).toBeInTheDocument();
    expect(
      screen.getByText("Contacted/Missed Appointment"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Contacted/Quoted")).not.toBeInTheDocument();
  });

  it("falls back to default status options when no live Close statuses are available", () => {
    render(<LeadStatusSelector selected={[]} onChange={vi.fn()} />);

    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Contacted/Quoted")).toBeInTheDocument();
  });

  it("selects all rendered statuses when the bulk action is used", () => {
    const onChange = vi.fn();
    render(
      <LeadStatusSelector
        selected={[]}
        onChange={onChange}
        options={[
          { id: "stat_new", label: "New" },
          { id: "stat_reschedule", label: "Contacted/Reschedule" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /select all/i }));

    expect(onChange).toHaveBeenCalledWith(["Contacted/Reschedule", "New"]);
  });
});
