// src/features/kpi/components/WordTrackForm.tsx
// Form to add a personal word track.

import React, { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpsertWordTrack } from "../hooks";
import {
  WORD_TRACK_CATEGORY_OPTIONS,
  WORD_TRACK_MATCH_TYPE_OPTIONS,
  WORD_TRACK_SCOPE_OPTIONS,
  WORD_TRACK_TIMING_OPTIONS,
  type WordTrackCategory,
  type WordTrackExpectedTiming,
  type WordTrackMatchType,
  type WordTrackScope,
} from "../types/kpi.types";

interface FormState {
  label: string;
  phrase: string;
  category: WordTrackCategory;
  matchType: WordTrackMatchType;
  expectedTiming: WordTrackExpectedTiming;
  scope: WordTrackScope;
}

const EMPTY_FORM: FormState = {
  label: "",
  phrase: "",
  category: "general",
  matchType: "fuzzy",
  expectedTiming: "any",
  scope: "personal",
};

export const WordTrackForm: React.FC = () => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertWordTrack();

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !form.phrase.trim()) {
      setError("Label and phrase are required.");
      return;
    }
    setError(null);
    try {
      await upsert.mutateAsync({
        mode: "create",
        values: {
          label: form.label.trim(),
          phrase: form.phrase.trim(),
          category: form.category,
          match_type: form.matchType,
          expected_timing: form.expectedTiming,
          scope: form.scope,
        },
      });
      setForm(EMPTY_FORM);
    } catch {
      // toast surfaced by the mutation
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-border bg-card p-3 space-y-2"
    >
      <h3 className="text-xs font-semibold text-foreground">Add word track</h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-[10px]">Label</Label>
          <Input
            className="h-7 text-[11px]"
            value={form.label}
            onChange={(e) => setField("label", e.target.value)}
            placeholder="e.g. Disclosure statement"
          />
        </div>
        <div>
          <Label className="text-[10px]">Phrase</Label>
          <Input
            className="h-7 text-[11px]"
            value={form.phrase}
            onChange={(e) => setField("phrase", e.target.value)}
            placeholder="e.g. This call may be recorded"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div>
          <Label className="text-[10px]">Category</Label>
          <Select
            value={form.category}
            onValueChange={(v) => setField("category", v as WordTrackCategory)}
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
        </div>
        <div>
          <Label className="text-[10px]">Match type</Label>
          <Select
            value={form.matchType}
            onValueChange={(v) =>
              setField("matchType", v as WordTrackMatchType)
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
        </div>
        <div>
          <Label className="text-[10px]">Timing</Label>
          <Select
            value={form.expectedTiming}
            onValueChange={(v) =>
              setField("expectedTiming", v as WordTrackExpectedTiming)
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
        </div>
        <div>
          <Label className="text-[10px]">Scope</Label>
          <Select
            value={form.scope}
            onValueChange={(v) => setField("scope", v as WordTrackScope)}
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
        </div>
      </div>

      {error ? (
        <div className="text-[10px] text-destructive">{error}</div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          className="h-7 text-[11px]"
          disabled={upsert.isPending}
        >
          {upsert.isPending ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Saving
            </>
          ) : (
            <>
              <Plus className="mr-1 h-3 w-3" /> Add
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
