// src/features/channel-orchestration/components/rules/TemplateSelector.tsx
import { useState, useEffect } from "react";
import { FileText, Loader2, AlertTriangle, Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

/** User-friendly descriptions that override the technical API descriptions */
const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  sms_first_voice_escalation:
    "Texts leads first. If they don't respond after a few attempts, the system automatically switches to calling them instead. Good for most situations.",
  voice_first_sms_fallback:
    "Calls leads first. If they don't pick up or it goes to voicemail, switches to texting. Best for high-value leads where a phone call converts better.",
  parallel_channels:
    "Uses both texting and calling at the same time with short breaks between attempts. Best for time-sensitive leads where speed matters most.",
  business_hours_voice:
    "Calls leads during business hours (Mon-Fri 9am-5pm Eastern). Outside those hours, texts only. Keeps calls professional and respectful of personal time.",
  insurance_standard:
    "Our recommended setup for insurance agents. Texts first during the day, automatically switches to calling if texts don't get a response. Special routing for veteran leads, no calls on weekends, and smart cooldowns to avoid over-contacting. Start here and customize to fit your workflow.",
  quoted_leads_voice:
    "Prioritizes calling leads who already have a quote. These leads are closer to buying, so a phone call helps close the deal faster. Other leads get texts.",
};

function getTemplateDescription(template: OrchestrationTemplate): string {
  return TEMPLATE_DESCRIPTIONS[template.id] ?? template.description;
}

interface Props {
  hasExistingRules: boolean;
  smsAvailable: boolean;
  voiceAvailable: boolean;
}

export function TemplateSelector({
  hasExistingRules,
  smsAvailable,
  voiceAvailable,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  const { data: templates = [], isLoading: templatesLoading } =
    useOrchestrationTemplates(open);
  const { data: preview, isLoading: previewLoading } =
    useOrchestrationTemplatePreview(selectedKey, open);
  const applyTemplate = useApplyTemplate();

  // Auto-select the default template when dialog opens
  useEffect(() => {
    if (open && !selectedKey && templates.length > 0) {
      const defaultTemplate = templates.find((t) => t.tags.includes("default"));
      if (defaultTemplate) {
        setSelectedKey(defaultTemplate.id);
      }
    }
  }, [open, templates, selectedKey]);

  const handleApply = () => {
    if (!selectedKey) return;
    applyTemplate.mutate(
      { templateKey: selectedKey, mode },
      { onSuccess: () => setOpen(false) },
    );
  };

  const selectedTemplate = templates.find((t) => t.id === selectedKey);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-[10px]">
          <FileText className="h-3 w-3 mr-1" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">Apply Template</DialogTitle>
          <DialogDescription className="text-[10px] text-zinc-500">
            Choose a pre-built rule template. Select one on the left, preview
            its rules on the right, then apply.
          </DialogDescription>
        </DialogHeader>

        {templatesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-[11px] text-zinc-500 py-6 text-center">
            No templates available.
          </p>
        ) : (
          <div className="flex gap-3 min-h-0 flex-1">
            {/* Left: Template List */}
            <div className="w-52 shrink-0 overflow-y-auto space-y-1 pr-1">
              {templates.map((t: OrchestrationTemplate) => {
                const isDefault = t.tags.includes("default");
                const isSelected = selectedKey === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedKey(t.id)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded border transition-colors",
                      isSelected
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30"
                        : isDefault
                          ? "border-emerald-200 dark:border-emerald-800 hover:border-emerald-300"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300",
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <Check className="h-3 w-3 text-blue-500 shrink-0" />
                      )}
                      <span className="text-[10px] font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {t.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge
                        variant="secondary"
                        className="h-3.5 px-1 text-[8px]"
                      >
                        {t.ruleCount} rules
                      </Badge>
                      {isDefault && (
                        <Badge className="h-3.5 px-1 text-[8px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700">
                          <Star className="h-2 w-2 mr-0.5" />
                          Recommended
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Preview + Apply */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              {!selectedKey ? (
                <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-400">
                  Select a template to preview
                </div>
              ) : (
                <>
                  {/* Template Description */}
                  {selectedTemplate && (
                    <div className="mb-2">
                      <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                        {selectedTemplate.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {getTemplateDescription(selectedTemplate)}
                      </p>
                    </div>
                  )}

                  {/* Rules Preview */}
                  <div className="flex-1 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded p-2 mb-2">
                    {previewLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                      </div>
                    ) : preview ? (
                      <div className="space-y-1">
                        {preview.rules.map((r, i) => (
                          <div
                            key={r.id}
                            className="flex items-start gap-1.5 text-[10px]"
                          >
                            <span className="text-zinc-400 shrink-0 w-3 text-right">
                              {i + 1}.
                            </span>
                            <div className="min-w-0">
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                {r.name}
                              </span>
                              <span className="text-zinc-400 ml-1">
                                →{" "}
                                {r.action.allowedChannels
                                  .map((c) => (c === "sms" ? "SMS" : "Voice"))
                                  .join(" + ")}
                                {r.action.cooldownMinutes
                                  ? ` (${r.action.cooldownMinutes}m cooldown)`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                        <div className="text-[9px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                          Fallback:{" "}
                          {preview.fallbackAction.allowedChannels
                            .map((c) => (c === "sms" ? "SMS" : "Voice"))
                            .join(" + ")}{" "}
                          (prefer{" "}
                          {preview.fallbackAction.preferredChannel === "sms"
                            ? "SMS"
                            : "Voice"}
                          )
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-400 text-center py-4">
                        Unable to load preview
                      </p>
                    )}
                  </div>

                  {/* Channel availability warning */}
                  {preview &&
                    (() => {
                      const usesVoice =
                        preview.rules.some((r) =>
                          r.action.allowedChannels.includes("voice"),
                        ) ||
                        preview.fallbackAction.allowedChannels.includes(
                          "voice",
                        );
                      const usesSms =
                        preview.rules.some((r) =>
                          r.action.allowedChannels.includes("sms"),
                        ) ||
                        preview.fallbackAction.allowedChannels.includes("sms");
                      const warnings: string[] = [];
                      if (usesVoice && !voiceAvailable)
                        warnings.push("Voice Agent is not active");
                      if (usesSms && !smsAvailable)
                        warnings.push("SMS Bot is not active");
                      if (warnings.length === 0) return null;
                      return (
                        <div className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1.5 mb-2">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                          <span>
                            This template references channels you haven't
                            configured: {warnings.join(", ")}. Rules targeting
                            inactive channels will have no effect.
                          </span>
                        </div>
                      );
                    })()}

                  {/* Mode + Apply */}
                  <div className="space-y-1.5 shrink-0">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setMode("replace")}
                        className={cn(
                          "flex-1 px-2 py-1 rounded border text-[10px] text-left transition-colors",
                          mode === "replace"
                            ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30"
                            : "border-zinc-200 dark:border-zinc-700",
                        )}
                      >
                        <span className="font-medium">Replace</span>
                        <span className="text-zinc-500 ml-1">
                          — wipe existing rules
                        </span>
                      </button>
                      <button
                        onClick={() => setMode("append")}
                        className={cn(
                          "flex-1 px-2 py-1 rounded border text-[10px] text-left transition-colors",
                          mode === "append"
                            ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30"
                            : "border-zinc-200 dark:border-zinc-700",
                        )}
                      >
                        <span className="font-medium">Append</span>
                        <span className="text-zinc-500 ml-1">
                          — add after existing
                        </span>
                      </button>
                    </div>

                    {mode === "replace" && hasExistingRules && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1">
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
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
