// src/features/call-reviews/hooks/useCallScriptsLibrary.ts
// Data layer for the AI-generated master Sales Scripts library (kpi_call_scripts).
// One script per (imo, call_type): admins generate via the `generate-call-script`
// edge fn (writes via service_role); all approved IMO agents read once a body
// exists. Reads poll every 5s while a generation is settling.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import { useKpiIdentity } from "@/features/kpi";
import { callReviewKeys } from "./callReviewKeys";
import {
  isScriptSettling,
  parseGeneratedScript,
  type GeneratedScriptRow,
} from "../types";

const SELECT = "*, call_type:call_type_id(id, name)";

function toRow(raw: Record<string, unknown>): GeneratedScriptRow {
  return {
    ...(raw as unknown as GeneratedScriptRow),
    script_body: parseGeneratedScript(raw.script_body),
  };
}

/** All generated scripts for an IMO, keyed for join-by-call_type in the UI. */
export function useGeneratedScripts(imoId: string | undefined) {
  return useQuery({
    queryKey: callReviewKeys.generatedScripts(imoId ?? "none"),
    queryFn: async (): Promise<GeneratedScriptRow[]> => {
      const { data, error } = await supabase
        .from("kpi_call_scripts")
        .select(SELECT)
        .eq("imo_id", imoId as string)
        .order("generated_at", { ascending: false, nullsFirst: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => toRow(r as Record<string, unknown>));
    },
    enabled: !!imoId,
    staleTime: 30_000,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => isScriptSettling(r)) ? 5_000 : false,
  });
}

/** The single master script for one call type (or null if none generated yet). */
export function useGeneratedScript(callTypeId: string | undefined) {
  return useQuery({
    queryKey: callReviewKeys.generatedScript(callTypeId ?? "none"),
    queryFn: async (): Promise<GeneratedScriptRow | null> => {
      const { data, error } = await supabase
        .from("kpi_call_scripts")
        .select(SELECT)
        .eq("call_type_id", callTypeId as string)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toRow(data as Record<string, unknown>) : null;
    },
    enabled: !!callTypeId,
    staleTime: 15_000,
    refetchInterval: (query) =>
      isScriptSettling(query.state.data) ? 5_000 : false,
  });
}

/** Admin-only: kick off (or refresh) the master script for a call type. */
export function useGenerateCallScript() {
  const queryClient = useQueryClient();
  const { imoId } = useKpiIdentity();
  return useMutation({
    mutationFn: async (callTypeId: string) => {
      // imo_id is NOT sent — the edge fn derives it from the call type.
      const { data, error } = await supabase.functions.invoke(
        "generate-call-script",
        { body: { call_type_id: callTypeId } },
      );
      if (error) {
        // FunctionsHttpError (409 "already running", 403 "not admin", …) carries
        // the raw Response in `.context`; pull the JSON body's `error` so the
        // user sees the actionable server message, not the generic SDK string.
        let message = error.message;
        const ctx = (error as { context?: unknown }).context;
        if (ctx && typeof (ctx as Response).json === "function") {
          try {
            const body = await (ctx as Response).json();
            if (body?.error) message = body.error as string;
          } catch {
            /* non-JSON body — keep the generic message */
          }
        }
        throw new Error(message);
      }
      return data as { ok?: boolean; status?: string; error?: string };
    },
    onSuccess: (data, callTypeId) => {
      // The edge fn returns HTTP 200 with ok:false for the below-floor case
      // (either a recorded failure or a no-op that kept an existing good script).
      if (data?.ok === false) {
        toast.error(
          data.error ?? "Not enough sold calls to build a script yet.",
        );
      } else {
        toast.success("Generating the master script from sold calls…");
      }
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.generatedScript(callTypeId),
      });
      if (imoId) {
        queryClient.invalidateQueries({
          queryKey: callReviewKeys.generatedScripts(imoId),
        });
      }
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Could not start generation",
      ),
  });
}
