// src/features/kpi/components/RecordingUploadDropZone.tsx
// Drag-drop / browse upload for a call recording, with a metadata form.
// On submit: upload the audio file to storage, then insert the recording row
// (agent = self, transcription_status = 'pending').

import React, { useRef, useState } from "react";
import { Upload, FileAudio, X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUploadRecording, type RecordingUploadMeta } from "../hooks";
import {
  CALL_DIRECTION_OPTIONS,
  CALL_OUTCOME_OPTIONS,
  CALLER_AGE_BAND_OPTIONS,
  CALLER_GENDER_OPTIONS,
  US_STATES,
  type CallDirection,
  type CallerAgeBand,
  type CallerGender,
  type CallOutcome,
} from "../types/kpi.types";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB (matches bucket limit)

interface MetaFormState {
  callDirection: CallDirection;
  callAtLocal: string; // datetime-local value
  outcome: CallOutcome | "";
  callerName: string;
  callerGender: CallerGender | "";
  callerAge: string;
  callerAgeBand: CallerAgeBand | "";
  callerState: string;
  callerZip: string;
  notes: string;
}

const EMPTY_META: MetaFormState = {
  callDirection: "inbound",
  callAtLocal: "",
  outcome: "",
  callerName: "",
  callerGender: "",
  callerAge: "",
  callerAgeBand: "",
  callerState: "",
  callerZip: "",
  notes: "",
};

export const RecordingUploadDropZone: React.FC = () => {
  const upload = useUploadRecording();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MetaFormState>(EMPTY_META);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const reset = () => {
    setFile(null);
    setMeta(EMPTY_META);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = (f: File): string | null => {
    const isAudio = f.type.startsWith("audio/") || f.type === "video/mp4";
    if (!isAudio) return "Only audio files are allowed";
    if (f.size > MAX_FILE_SIZE) return "File exceeds 500 MB";
    return null;
  };

  const accept = (f: File) => {
    const v = validate(f);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setFile(f);
  };

  const setField = (key: keyof MetaFormState, value: string) =>
    setMeta((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Pick an audio file first.");
      return;
    }
    const payload: RecordingUploadMeta = {
      call_direction: meta.callDirection,
      call_at: meta.callAtLocal
        ? new Date(meta.callAtLocal).toISOString()
        : null,
      outcome: meta.outcome || null,
      caller_name: meta.callerName.trim() || null,
      caller_gender: meta.callerGender || null,
      caller_age: meta.callerAge.trim() === "" ? null : Number(meta.callerAge),
      caller_age_band: meta.callerAgeBand || null,
      caller_state: meta.callerState || null,
      caller_zip: meta.callerZip.trim() || null,
      notes: meta.notes.trim() || null,
    };
    try {
      await upload.mutateAsync({ file, meta: payload });
      reset();
    } catch {
      // toast surfaced by the mutation
    }
  };

  const isWorking = upload.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-dashed border-border bg-card p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold text-foreground">
          Upload call recording
        </div>
        <div className="text-[10px] text-muted-foreground">
          audio · max 500MB
        </div>
      </div>

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) accept(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-md border-2 border-dashed px-3 py-6 text-center text-[11px] ${
            drag
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
          }`}
        >
          <Upload className="mx-auto mb-1 h-4 w-4" />
          Drop audio here or click to browse
          <Input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/mp4"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) accept(f);
            }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded bg-muted px-2 py-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 truncate">
              <FileAudio className="h-3 w-3 shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-muted-foreground">
                · {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={reset}
              disabled={isWorking}
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <Label className="text-[10px]">Direction</Label>
              <Select
                value={meta.callDirection}
                onValueChange={(v) => setField("callDirection", v)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALL_DIRECTION_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-[11px]"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px]">Call time</Label>
              <Input
                type="datetime-local"
                className="h-7 text-[11px]"
                value={meta.callAtLocal}
                onChange={(e) => setField("callAtLocal", e.target.value)}
              />
            </div>

            <div>
              <Label className="text-[10px]">Outcome</Label>
              <Select
                value={meta.outcome}
                onValueChange={(v) => setField("outcome", v)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {CALL_OUTCOME_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-[11px]"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px]">Caller name</Label>
              <Input
                className="h-7 text-[11px]"
                value={meta.callerName}
                onChange={(e) => setField("callerName", e.target.value)}
                placeholder="—"
              />
            </div>

            <div>
              <Label className="text-[10px]">Gender</Label>
              <Select
                value={meta.callerGender}
                onValueChange={(v) => setField("callerGender", v)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {CALLER_GENDER_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-[11px]"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px]">Age</Label>
              <Input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                className="h-7 text-[11px]"
                value={meta.callerAge}
                onChange={(e) => setField("callerAge", e.target.value)}
                placeholder="—"
              />
            </div>

            <div>
              <Label className="text-[10px]">Age band</Label>
              <Select
                value={meta.callerAgeBand}
                onValueChange={(v) => setField("callerAgeBand", v)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {CALLER_AGE_BAND_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-[11px]"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px]">State</Label>
              <Select
                value={meta.callerState}
                onValueChange={(v) => setField("callerState", v)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-[11px]"
                    >
                      {o.value} · {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px]">ZIP</Label>
              <Input
                className="h-7 text-[11px]"
                value={meta.callerZip}
                onChange={(e) => setField("callerZip", e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Notes</Label>
            <Textarea
              className="min-h-[44px] text-[11px]"
              value={meta.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Optional context for this call…"
            />
          </div>

          {error ? (
            <div className="flex items-center gap-1 text-[10px] text-destructive">
              <AlertCircle className="h-3 w-3" /> {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="h-7 text-[11px]"
              disabled={isWorking}
            >
              {isWorking ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Uploading
                </>
              ) : (
                "Upload recording"
              )}
            </Button>
          </div>
        </div>
      )}

      {!file && error ? (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-destructive">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      ) : null}
    </form>
  );
};
