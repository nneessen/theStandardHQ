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
});
