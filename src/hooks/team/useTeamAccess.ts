// src/hooks/team/useTeamAccess.ts
//
// Mutations for self-service team management (authorized server-side to the
// caller's own downline): resend a member's "set your password" link, and
// reversibly disable / re-enable a member's sign-in.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  resendAccountSetup,
  setMemberAccess,
} from "@/services/users/accountSetupService";

// Toast-free: callers handle their own messaging (AgentTable shows a toast;
// EditUserDialog needs the raw result so it can fall back to creating the account).
export function useResendAccountSetup() {
  return useMutation({
    mutationFn: (userId: string) => resendAccountSetup(userId),
  });
}

interface SetAccessVars {
  userId: string;
  action: "disable" | "enable";
  reason?: string;
}

export function useSetMemberAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, action, reason }: SetAccessVars) =>
      setMemberAccess(userId, action, reason),
    onSuccess: (res, vars) => {
      if (res.success) {
        toast.success(
          vars.action === "disable" ? "Access disabled." : "Access restored.",
        );
        queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
        queryClient.invalidateQueries({ queryKey: ["recruits"] });
      } else {
        toast.error(res.message || res.error || "Couldn't update access.");
      }
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't update access."),
  });
}
