// src/features/kpi/components/WordTrackLibrary.tsx
// Lists the agent's active word tracks with inline edit + delete.

import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWordTracks,
  useUpsertWordTrack,
  useDeleteWordTrack,
} from "../hooks";
import {
  WORD_TRACK_CATEGORY_OPTIONS,
  WORD_TRACK_MATCH_TYPE_OPTIONS,
  WORD_TRACK_SCOPE_OPTIONS,
  WORD_TRACK_TIMING_OPTIONS,
  type WordTrackCategory,
  type WordTrackExpectedTiming,
  type WordTrackMatchType,
  type WordTrackRow,
  type WordTrackScope,
} from "../types/kpi.types";

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  WORD_TRACK_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);
const TIMING_LABELS: Record<string, string> = Object.fromEntries(
  WORD_TRACK_TIMING_OPTIONS.map((o) => [o.value, o.label]),
);

interface EditState {
  label: string;
  phrase: string;
  category: WordTrackCategory;
  matchType: WordTrackMatchType;
  expectedTiming: WordTrackExpectedTiming;
  scope: WordTrackScope;
}

const WordTrackItem: React.FC<{
  track: WordTrackRow;
  showScripts: boolean;
  scriptCount: number;
}> = ({ track, showScripts, scriptCount }) => {
  const upsert = useUpsertWordTrack();
  const remove = useDeleteWordTrack();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState>({
    label: track.label,
    phrase: track.phrase,
    category: track.category as WordTrackCategory,
    matchType: track.match_type as WordTrackMatchType,
    expectedTiming: track.expected_timing as WordTrackExpectedTiming,
    scope: track.scope as WordTrackScope,
  });

  const startEdit = () => {
    setEdit({
      label: track.label,
      phrase: track.phrase,
      category: track.category as WordTrackCategory,
      matchType: track.match_type as WordTrackMatchType,
      expectedTiming: track.expected_timing as WordTrackExpectedTiming,
      scope: track.scope as WordTrackScope,
    });
    setEditing(true);
  };

  const save = async () => {
    if (!edit.label.trim() || !edit.phrase.trim()) return;
    await upsert.mutateAsync({
      mode: "update",
      id: track.id,
      values: {
        label: edit.label.trim(),
        phrase: edit.phrase.trim(),
        category: edit.category,
        match_type: edit.matchType,
        expected_timing: edit.expectedTiming,
        scope: edit.scope,
      },
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="border-b border-border/60 last:border-0">
        <td className="px-2 py-1.5">
          <Input
            className="h-7 text-[11px]"
            value={edit.label}
            onChange={(e) => setEdit((p) => ({ ...p, label: e.target.value }))}
          />
        </td>
        <td className="px-2 py-1.5">
          <Input
            className="h-7 text-[11px]"
            value={edit.phrase}
            onChange={(e) => setEdit((p) => ({ ...p, phrase: e.target.value }))}
          />
        </td>
        <td className="px-2 py-1.5">
          <Select
            value={edit.category}
            onValueChange={(v) =>
              setEdit((p) => ({ ...p, category: v as WordTrackCategory }))
            }
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORD_TRACK_CATEGORY_OPTIONS.map((o) => (
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
        </td>
        <td className="px-2 py-1.5">
          <Select
            value={edit.matchType}
            onValueChange={(v) =>
              setEdit((p) => ({ ...p, matchType: v as WordTrackMatchType }))
            }
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORD_TRACK_MATCH_TYPE_OPTIONS.map((o) => (
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
        </td>
        <td className="px-2 py-1.5">
          <Select
            value={edit.expectedTiming}
            onValueChange={(v) =>
              setEdit((p) => ({
                ...p,
                expectedTiming: v as WordTrackExpectedTiming,
              }))
            }
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORD_TRACK_TIMING_OPTIONS.map((o) => (
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
        </td>
        <td className="px-2 py-1.5">
          <Select
            value={edit.scope}
            onValueChange={(v) =>
              setEdit((p) => ({ ...p, scope: v as WordTrackScope }))
            }
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORD_TRACK_SCOPE_OPTIONS.map((o) => (
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
        </td>
        {showScripts && <td className="px-2 py-1.5" />}
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="text-success hover:opacity-80 disabled:opacity-50"
              onClick={save}
              disabled={upsert.isPending}
              aria-label="Save"
            >
              {upsert.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(false)}
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-2 py-1.5 font-medium text-foreground">{track.label}</td>
      <td className="px-2 py-1.5 text-foreground">{track.phrase}</td>
      <td className="px-2 py-1.5 text-foreground">
        {CATEGORY_LABELS[track.category] ?? track.category}
      </td>
      <td className="px-2 py-1.5 text-foreground">{track.match_type}</td>
      <td className="px-2 py-1.5 text-foreground">
        {TIMING_LABELS[track.expected_timing] ?? track.expected_timing}
      </td>
      <td className="px-2 py-1.5">
        <Badge className="h-4 bg-muted px-1.5 text-[9px] font-medium text-muted-foreground">
          {track.scope}
        </Badge>
      </td>
      {showScripts && (
        <td className="px-2 py-1.5">
          {scriptCount > 0 ? (
            <Link
              to="/call-reviews/scripts"
              className="inline-flex"
              title={`Used in ${scriptCount} Sales Script${
                scriptCount === 1 ? "" : "s"
              }`}
            >
              <Badge className="h-4 bg-primary/15 px-1.5 text-[9px] font-medium text-primary hover:bg-primary/25">
                {scriptCount}
              </Badge>
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={startEdit}
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
            onClick={() => remove.mutate(track.id)}
            disabled={remove.isPending}
            aria-label="Delete"
          >
            {remove.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
};

export const WordTrackLibrary: React.FC<{
  /** word_track_id → number of Sales Scripts citing it. When provided, a
   *  "Scripts" column is shown badging each track with its usage count. */
  scriptUsage?: Map<string, number>;
}> = ({ scriptUsage }) => {
  const { data: tracks, isLoading, isError, error } = useWordTracks();
  const showScripts = scriptUsage != null;

  if (isLoading) {
    return (
      <div className="py-8 text-center text-[11px] text-muted-foreground">
        Loading word tracks…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="py-8 text-center text-[11px] text-destructive">
        {error instanceof Error ? error.message : "Failed to load word tracks"}
      </div>
    );
  }
  if (!tracks || tracks.length === 0) {
    return (
      <div className="py-8 text-center text-[11px] text-muted-foreground">
        No word tracks yet. Add one above.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">Label</th>
            <th className="px-2 py-1.5 font-medium">Phrase</th>
            <th className="px-2 py-1.5 font-medium">Category</th>
            <th className="px-2 py-1.5 font-medium">Match</th>
            <th className="px-2 py-1.5 font-medium">Timing</th>
            <th className="px-2 py-1.5 font-medium">Scope</th>
            {showScripts && (
              <th className="px-2 py-1.5 font-medium">Scripts</th>
            )}
            <th className="px-2 py-1.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((t) => (
            <WordTrackItem
              key={t.id}
              track={t}
              showScripts={showScripts}
              scriptCount={scriptUsage?.get(t.id) ?? 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
