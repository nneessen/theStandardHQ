// src/features/kpi/hooks/useRecordings.ts
// Query + mutation hooks for kpi_call_recordings (self-scoped, Phase 1).
// No transcription pipeline yet — uploads land with transcription_status
// 'pending' (the DB default) and no polling is wired.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import { kpiKeys, useKpiIdentity } from "./kpiKeys";
import {
  CALL_RECORDINGS_BUCKET,
  recordingStorageService,
} from "../services/recordingStorageService";
import {
  readCallRecordingQuotaGb,
  quotaBytesFromGb,
  bytesToGb,
} from "../utils/recordingQuota";
import type { CallRecordingInsert, CallRecordingRow } from "../types/kpi.types";

// ─── Read: the current agent's uploaded recordings ──────────────────────────

async function fetchRecordings(agentId: string): Promise<CallRecordingRow[]> {
  const { data, error } = await supabase
    .from("kpi_call_recordings")
    .select("*")
    .eq("agent_id", agentId)
    .order("call_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useRecordingsList() {
  const { user } = useAuth();
  const agentId = user?.id ?? "";

  return useQuery({
    queryKey: kpiKeys.recordings(agentId),
    queryFn: () => fetchRecordings(agentId),
    enabled: !!agentId,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });
}

// ─── Write: upload file to storage, then insert the recording row ───────────

/** Metadata captured alongside the file in the upload form. */
export type RecordingUploadMeta = Omit<
  CallRecordingInsert,
  | "imo_id"
  | "agent_id"
  | "uploader_id"
  | "storage_bucket"
  | "storage_path"
  | "original_filename"
  | "mime_type"
  | "file_size_bytes"
  | "transcription_status"
>;

export function useUploadRecording() {
  const queryClient = useQueryClient();
  const { userId, imoId } = useKpiIdentity();
  const { imo } = useImo();

  return useMutation({
    mutationFn: async ({
      file,
      meta,
      agentId,
    }: {
      file: File;
      meta: RecordingUploadMeta;
      // Optional owning agent. Defaults to the uploader (self) — only a
      // super-admin / IMO-admin may set this to another agent (enforced by the
      // recording INSERT RLS: agent_id = self OR is_upline_of OR is_imo_admin).
      // For an off-system agent, leave this unset and pass the typed name in
      // meta.metadata.external_agent_name instead.
      agentId?: string | null;
    }) => {
      if (!userId || !imoId) {
        throw new Error("Your account is not linked to an IMO yet.");
      }

      // 0. Per-IMO storage quota (opt-in). Block before touching storage so a
      //    rejected upload leaves nothing to roll back. Usage comes from a
      //    SECURITY-DEFINER RPC so the whole-IMO total is visible to any agent.
      const quotaGb = readCallRecordingQuotaGb(imo);
      if (quotaGb != null) {
        const { data: usedBytes, error: usageErr } = await supabase.rpc(
          "get_imo_call_recording_usage_bytes",
        );
        if (usageErr) throw new Error(usageErr.message);
        const used = usedBytes ?? 0;
        if (used + file.size > quotaBytesFromGb(quotaGb)) {
          throw new Error(
            `Your team's call-recording storage is full (${bytesToGb(used)} / ${quotaGb} GB). ` +
              `Remove old recordings or wait for the 180-day retention to free space.`,
          );
        }
      }

      // 1. Upload the file into the UPLOADER's folder (storage RLS always allows
      //    foldername[1] = auth.uid()). The storage path is decoupled from the
      //    owning agent_id — playback is granted IMO-wide by the read policies —
      //    so a super-admin uploading on another agent's behalf still writes to
      //    their own folder while the row is attributed to that agent.
      const { storagePath } = await recordingStorageService.upload(
        file,
        userId,
      );

      // 2. Insert the metadata row. Roll back the storage object if it fails so
      //    we never orphan an uploaded file with no DB record.
      const payload: CallRecordingInsert = {
        ...meta,
        imo_id: imoId,
        agent_id: agentId || userId,
        uploader_id: userId,
        storage_bucket: CALL_RECORDINGS_BUCKET,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        transcription_status: "pending",
      };

      const { data, error } = await supabase
        .from("kpi_call_recordings")
        .insert(payload)
        .select()
        .single();

      if (error) {
        await recordingStorageService.remove(storagePath);
        throw new Error(error.message);
      }
      return data as CallRecordingRow;
    },
    onSuccess: (data) => {
      toast.success("Recording uploaded");
      queryClient.invalidateQueries({ queryKey: kpiKeys.all });
      // Fire-and-forget transcription. The row's transcription_status reflects
      // progress/outcome, so we never block (or fail) the upload UX on this and
      // we swallow invoke errors. The authed supabase client forwards the JWT.
      void supabase.functions
        .invoke("transcribe-call-recording", {
          body: { recording_id: data.id },
        })
        .catch(() => {});
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload recording",
      );
    },
  });
}
