// Query hook for the "Clone to teammate" dialog's picker.
//
// Wraps the get_teammates_with_close_connected RPC which returns the set of
// users the caller may clone Close library items TO. Authorization rule
// (downlines + immediate siblings + super-admin → anyone) lives in the
// Postgres function — see migration 20260408085031.
//
// Co-located with the close-ai-builder feature rather than living in
// src/hooks/ to keep this domain self-contained.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import type { CloneEligibleTeammate } from "../types/close-ai-builder.types";
import { closeAiBuilderKeys } from "./useCloseAiBuilder";

export function useCloneEligibleTeammates(enabled = true) {
  return useQuery({
    queryKey: [...closeAiBuilderKeys.all, "clone-eligible-teammates"] as const,
    enabled,
    // Connection status can flip in either direction (revoke / reconnect).
    // 2 minutes is short enough that a stale picker recovers quickly without
    // hammering the RPC on every dialog open.
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<CloneEligibleTeammate[]> => {
      const { data, error } = await supabase.rpc(
        "get_teammates_with_close_connected",
      );
      if (error) throw error;
      return (data ?? []) as CloneEligibleTeammate[];
    },
  });
}
