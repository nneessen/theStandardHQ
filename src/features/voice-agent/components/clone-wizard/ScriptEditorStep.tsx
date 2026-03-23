import { useState, useCallback } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useVoiceCloneScripts,
  useUpdateVoiceCloneScripts,
  useResetVoiceCloneScripts,
  type VoiceCloneScript,
} from "@/features/chat-bot";

interface ScriptEditorStepProps {
  onContinue: () => void;
}

function reindex(scripts: VoiceCloneScript[]): VoiceCloneScript[] {
  return scripts.map((s, i) => ({ ...s, segmentIndex: i }));
}

export function ScriptEditorStep({ onContinue }: ScriptEditorStepProps) {
  const { data: scriptsData, isLoading } = useVoiceCloneScripts();
  const updateMutation = useUpdateVoiceCloneScripts();
  const resetMutation = useResetVoiceCloneScripts();

  const [localScripts, setLocalScripts] = useState<VoiceCloneScript[] | null>(
    null,
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Use local edits if they exist, otherwise use fetched data
  const scripts = localScripts ?? scriptsData?.scripts ?? [];
  const isCustom = scriptsData?.isCustom ?? false;
  const hasLocalEdits = localScripts !== null;

  const updateScript = useCallback(
    (index: number, patch: Partial<VoiceCloneScript>) => {
      setLocalScripts((prev) => {
        const base = prev ?? scriptsData?.scripts ?? [];
        const next = [...base];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    [scriptsData?.scripts],
  );

  const addScript = useCallback(() => {
    if (scripts.length >= 25) return;
    setLocalScripts((prev) => {
      const base = prev ?? scriptsData?.scripts ?? [];
      return reindex([
        ...base,
        {
          segmentIndex: base.length,
          category: "",
          title: "",
          scriptText: "",
          minDurationSeconds: 120,
          targetDurationSeconds: 300,
          optional: false,
        },
      ]);
    });
    setExpandedIndex(scripts.length);
  }, [scripts.length, scriptsData?.scripts]);

  const removeScript = useCallback(
    (index: number) => {
      if (scripts.length <= 15) return;
      setLocalScripts((prev) => {
        const base = prev ?? scriptsData?.scripts ?? [];
        return reindex(base.filter((_, i) => i !== index));
      });
      setExpandedIndex(null);
    },
    [scripts.length, scriptsData?.scripts],
  );

  const moveScript = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= scripts.length) return;
      setLocalScripts((prev) => {
        const base = [...(prev ?? scriptsData?.scripts ?? [])];
        [base[index], base[target]] = [base[target], base[index]];
        return reindex(base);
      });
      setExpandedIndex(target);
    },
    [scripts.length, scriptsData?.scripts],
  );

  const handleSave = useCallback(() => {
    if (!localScripts) return;
    updateMutation.mutate(localScripts, {
      onSuccess: () => setLocalScripts(null),
    });
  }, [localScripts, updateMutation]);

  const handleReset = useCallback(() => {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        setLocalScripts(null);
        setConfirmReset(false);
      },
    });
  }, [resetMutation]);

  // Validation
  const validationErrors: string[] = [];
  if (scripts.length < 15)
    validationErrors.push("At least 15 scripts required");
  if (scripts.length > 25) validationErrors.push("Maximum 25 scripts allowed");
  for (let i = 0; i < scripts.length; i++) {
    if (!scripts[i].title.trim())
      validationErrors.push(`Script ${i + 1}: title required`);
    if (!scripts[i].scriptText.trim())
      validationErrors.push(`Script ${i + 1}: text required`);
    if (!scripts[i].category.trim())
      validationErrors.push(`Script ${i + 1}: category required`);
  }
  const canSave = hasLocalEdits && validationErrors.length === 0;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
              Recording Scripts
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              Review and customize the scripts you'll read aloud during
              recording.
              {isCustom && (
                <Badge className="ml-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  Custom
                </Badge>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCustom && !confirmReset && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1"
                onClick={() => setConfirmReset(true)}
                disabled={resetMutation.isPending}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to defaults
              </Button>
            )}
            {confirmReset && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Are you sure?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={handleReset}
                  disabled={resetMutation.isPending}
                >
                  {resetMutation.isPending ? "Resetting..." : "Yes, reset"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
            {canSave && (
              <Button
                size="sm"
                className="h-7 text-[10px] gap-1"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save scripts
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Validation errors */}
      {hasLocalEdits && validationErrors.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 dark:border-red-900/50 dark:bg-red-950/20">
          <p className="text-[10px] text-red-600 dark:text-red-400">
            {validationErrors.slice(0, 3).join(" · ")}
            {validationErrors.length > 3 &&
              ` + ${validationErrors.length - 3} more`}
          </p>
        </div>
      )}

      {/* Script list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
        {scripts.map((script, i) => {
          const isExpanded = expandedIndex === i;
          const hasError =
            hasLocalEdits &&
            (!script.title.trim() ||
              !script.scriptText.trim() ||
              !script.category.trim());

          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border",
                hasError
                  ? "border-red-200 dark:border-red-900/50"
                  : "border-zinc-200 dark:border-zinc-800",
              )}
            >
              {/* Collapsed row */}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
              >
                <span className="text-[10px] font-medium text-zinc-400 w-5 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {script.title || "(untitled)"}
                  </p>
                  <p className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">
                    {script.category || "(no category)"} ·{" "}
                    {Math.round(script.targetDurationSeconds / 60)}m target
                    {script.optional && " · optional"}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-zinc-400 transition-transform flex-shrink-0",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="border-t border-zinc-200 px-3 py-3 space-y-3 dark:border-zinc-800">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Category</Label>
                      <Input
                        value={script.category}
                        onChange={(e) =>
                          updateScript(i, { category: e.target.value })
                        }
                        placeholder="e.g., Introduction"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Title</Label>
                      <Input
                        value={script.title}
                        onChange={(e) =>
                          updateScript(i, { title: e.target.value })
                        }
                        placeholder="e.g., Morning greeting"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px]">Script text</Label>
                      <span className="text-[9px] text-zinc-400">
                        {script.scriptText.length}/10000
                      </span>
                    </div>
                    <Textarea
                      value={script.scriptText}
                      onChange={(e) =>
                        updateScript(i, { scriptText: e.target.value })
                      }
                      placeholder="The text you'll read aloud during recording..."
                      className="min-h-[100px] text-xs"
                      maxLength={10000}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Min (sec)</Label>
                      <Input
                        type="number"
                        min={30}
                        value={script.minDurationSeconds}
                        onChange={(e) =>
                          updateScript(i, {
                            minDurationSeconds:
                              parseInt(e.target.value, 10) || 30,
                          })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Target (sec)</Label>
                      <Input
                        type="number"
                        min={30}
                        value={script.targetDurationSeconds}
                        onChange={(e) =>
                          updateScript(i, {
                            targetDurationSeconds:
                              parseInt(e.target.value, 10) || 30,
                          })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="flex items-end gap-2 pb-0.5">
                      <Switch
                        checked={script.optional}
                        onCheckedChange={(checked) =>
                          updateScript(i, { optional: checked })
                        }
                      />
                      <span className="text-[10px] text-zinc-500">
                        Optional
                      </span>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => moveScript(i, -1)}
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => moveScript(i, 1)}
                        disabled={i === scripts.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-zinc-400 hover:text-red-500 gap-1"
                      onClick={() => removeScript(i)}
                      disabled={scripts.length <= 15}
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add script button */}
        {scripts.length < 25 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-[11px] gap-1 mt-2"
            onClick={addScript}
          >
            <Plus className="h-3 w-3" />
            Add script ({scripts.length}/25)
          </Button>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {scripts.length} scripts ·{" "}
            {hasLocalEdits ? (
              <span className="text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            ) : (
              "Ready to record"
            )}
          </p>
          <Button
            size="sm"
            className="h-7 text-[11px] px-4"
            onClick={onContinue}
            disabled={hasLocalEdits}
          >
            Continue to Recording
          </Button>
        </div>
      </div>
    </div>
  );
}
