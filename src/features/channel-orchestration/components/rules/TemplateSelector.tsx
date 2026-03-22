// src/features/channel-orchestration/components/rules/TemplateSelector.tsx
import { useState } from "react";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useOrchestrationTemplates,
  useOrchestrationTemplatePreview,
  useApplyTemplate,
} from "../../hooks/useOrchestration";
import type { OrchestrationTemplate } from "../../types/orchestration.types";

interface Props {
  hasExistingRules: boolean;
}

export function TemplateSelector({ hasExistingRules }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  const { data: templates = [], isLoading: templatesLoading } =
    useOrchestrationTemplates(open);
  const { data: preview } = useOrchestrationTemplatePreview(selectedKey, open);
  const applyTemplate = useApplyTemplate();

  const handleApply = () => {
    if (!selectedKey) return;
    applyTemplate.mutate(
      { templateKey: selectedKey, mode },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-[10px]">
          <FileText className="h-3 w-3 mr-1" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Apply Template</DialogTitle>
        </DialogHeader>

        {templatesLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Template List */}
            <div className="space-y-1">
              {templates.map((t: OrchestrationTemplate) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedKey(t.id)}
                  className={cn(
                    "w-full text-left p-2 rounded border transition-colors",
                    selectedKey === t.id
                      ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
                      {t.name}
                    </span>
                    <Badge variant="secondary" className="h-4 px-1 text-[8px]">
                      {t.ruleCount} rules
                    </Badge>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {t.description}
                  </p>
                  {t.tags.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {t.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="h-4 px-1 text-[8px]"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Preview */}
            {preview && (
              <div className="border border-zinc-200 dark:border-zinc-700 rounded p-2">
                <p className="text-[10px] font-medium text-zinc-500 mb-1">
                  Preview: {preview.rules.length} rules
                </p>
                <div className="space-y-0.5">
                  {preview.rules.map((r, i) => (
                    <div
                      key={r.id}
                      className="text-[10px] text-zinc-600 dark:text-zinc-400"
                    >
                      <span className="text-zinc-400 mr-1">{i + 1}.</span>
                      {r.name} —{" "}
                      {r.action.allowedChannels
                        .map((c) => (c === "sms" ? "SMS" : "Voice"))
                        .join(" + ")}
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-400 mt-1">
                  Fallback:{" "}
                  {preview.fallbackAction.allowedChannels
                    .map((c) => (c === "sms" ? "SMS" : "Voice"))
                    .join(" + ")}{" "}
                  (prefer{" "}
                  {preview.fallbackAction.preferredChannel === "sms"
                    ? "SMS"
                    : "Voice"}
                  )
                </p>
              </div>
            )}

            {/* Mode Selection */}
            {selectedKey && (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("replace")}
                    className={cn(
                      "flex-1 p-2 rounded border text-[10px] text-left transition-colors",
                      mode === "replace"
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30"
                        : "border-zinc-200 dark:border-zinc-700",
                    )}
                  >
                    <span className="font-medium">Replace</span>
                    <p className="text-zinc-500 mt-0.5">
                      Remove existing rules, apply template
                    </p>
                  </button>
                  <button
                    onClick={() => setMode("append")}
                    className={cn(
                      "flex-1 p-2 rounded border text-[10px] text-left transition-colors",
                      mode === "append"
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30"
                        : "border-zinc-200 dark:border-zinc-700",
                    )}
                  >
                    <span className="font-medium">Append</span>
                    <p className="text-zinc-500 mt-0.5">
                      Add template rules after existing rules
                    </p>
                  </button>
                </div>

                {mode === "replace" && hasExistingRules && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded p-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    This will remove all existing rules
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full h-7 text-[10px]"
                  onClick={handleApply}
                  disabled={applyTemplate.isPending}
                >
                  {applyTemplate.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <FileText className="h-3 w-3 mr-1" />
                  )}
                  Apply Template
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
