import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const approveMutate = vi.fn();
const cancelMutate = vi.fn();
vi.mock("../../hooks/useAssistantActions", () => ({
  useApproveActionRequest: () => ({
    mutateAsync: approveMutate,
    isPending: false,
  }),
  useCancelActionRequest: () => ({
    mutateAsync: cancelMutate,
    isPending: false,
  }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: vi.fn(),
    message: vi.fn(),
  },
}));

import { ActionApprovalModal } from "../ActionApprovalModal";
import type { ActionRequest } from "../../types/assistant.types";

const emailAction: ActionRequest = {
  id: "a1",
  channel: "email",
  tool_name: "draftEmailMessage",
  draft_payload: { subject: "Subj", body: "Body text" },
  recipient: null,
  status: "pending_approval",
  created_at: null,
  error: null,
};

const closeNoteAction: ActionRequest = {
  id: "c1",
  channel: "close_note",
  tool_name: "draftCloseNote",
  draft_payload: {
    leadId: "lead_1",
    leadName: "Jane Doe",
    body: "Called, left VM.",
  },
  recipient: null,
  status: "pending_approval",
  created_at: null,
  error: null,
};

describe("ActionApprovalModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pre-fills the draft and blocks sending without a recipient", async () => {
    approveMutate.mockResolvedValue({ ok: true, status: "executed" });
    render(
      <ActionApprovalModal action={emailAction} open onOpenChange={() => {}} />,
    );

    expect(screen.getByDisplayValue("Subj")).toBeTruthy();
    expect(screen.getByDisplayValue("Body text")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(approveMutate).not.toHaveBeenCalled();
  });

  it("sends with the edited recipient and payload once valid", async () => {
    approveMutate.mockResolvedValue({ ok: true, status: "executed" });
    render(
      <ActionApprovalModal action={emailAction} open onOpenChange={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText(/to \(email\)/i), {
      target: { value: "lead@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => expect(approveMutate).toHaveBeenCalledTimes(1));
    expect(approveMutate).toHaveBeenCalledWith({
      id: "a1",
      recipient: "lead@example.com",
      payload: { subject: "Subj", body: "Body text" },
    });
  });

  it("approves a Close note WITHOUT a recipient and preserves leadId", async () => {
    approveMutate.mockResolvedValue({ ok: true, status: "executed" });
    render(
      <ActionApprovalModal
        action={closeNoteAction}
        open
        onOpenChange={() => {}}
      />,
    );

    // Shows the lead, the note text, and no recipient input.
    expect(screen.getByDisplayValue("Called, left VM.")).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.queryByLabelText(/to \(/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => expect(approveMutate).toHaveBeenCalledTimes(1));
    // No recipient, and the frozen leadId/leadName survive into the payload.
    expect(approveMutate).toHaveBeenCalledWith({
      id: "c1",
      payload: {
        leadId: "lead_1",
        leadName: "Jane Doe",
        body: "Called, left VM.",
      },
    });
  });
});
