import { useState } from "react";
import { Sparkles, WandSparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LLM_FIELD_HINTS } from "../../lib/retell-field-hints";
import { loadWizardData } from "../../lib/prompt-wizard-types";
import { FieldHint } from "./FieldHint";
import { BuilderSection } from "./BuilderSection";
import { PromptWizardForm } from "./PromptWizardForm";

interface InstructionsViewProps {
  generalPrompt: string;
  onGeneralPromptChange: (value: string) => void;
  boostedKeywords: string;
  onBoostedKeywordsChange: (value: string) => void;
  llmAvailable: boolean;
  llmLoading: boolean;
}

type Mode = "guided" | "advanced";

function detectInitialMode(generalPrompt: string): Mode {
  // If wizard data exists in localStorage, use guided mode
  if (loadWizardData()) return "guided";
  // If there's an existing raw prompt but no wizard data, use advanced
  if (generalPrompt.trim().length > 0) return "advanced";
  // New user — start with guided
  return "guided";
}

export function InstructionsView({
  generalPrompt,
  onGeneralPromptChange,
  boostedKeywords,
  onBoostedKeywordsChange,
  llmAvailable,
  llmLoading,
}: InstructionsViewProps) {
  const [mode, setMode] = useState<Mode>(() =>
    detectInitialMode(generalPrompt),
  );

  if (!llmAvailable && !llmLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
        Prompt editing becomes available when this workspace is using the
        managed voice model setup.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/40 w-fit">
        <button
          type="button"
          onClick={() => setMode("guided")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
            mode === "guided"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          <WandSparkles className="h-3.5 w-3.5" />
          Guided Setup
        </button>
        <button
          type="button"
          onClick={() => setMode("advanced")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
            mode === "advanced"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Advanced
        </button>
      </div>

      {/* Guided mode */}
      {mode === "guided" && (
        <PromptWizardForm onPromptChange={onGeneralPromptChange} />
      )}

      {/* Advanced mode — raw textarea */}
      {mode === "advanced" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <BuilderSection
            icon={<Sparkles className="h-4 w-4" />}
            title="Raw prompt editor"
            description="Write or paste your voice agent instructions directly. This is the exact text sent to the AI model."
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="retell-general-prompt">
                  Voice agent instructions
                </Label>
                <FieldHint>{LLM_FIELD_HINTS.generalPrompt}</FieldHint>
                <Textarea
                  id="retell-general-prompt"
                  value={generalPrompt}
                  onChange={(event) =>
                    onGeneralPromptChange(event.target.value)
                  }
                  className="min-h-[400px] text-xs font-mono"
                  placeholder={
                    "## Identity\nYou are [Agent Name], a friendly assistant at [Your Agency Name].\n\n## What to ask\n1. What type of coverage are you looking for?\n2. What state do you live in?\n\n## When to transfer\nTransfer when the caller asks for a specific person or is ready for a quote."
                  }
                />
              </div>
            </div>
          </BuilderSection>

          <div>
            <BuilderSection
              icon={<Sparkles className="h-4 w-4" />}
              title="Important names, products, or phrases"
              description="Words and phrases the voice recognition should prioritize for accuracy."
            >
              <div className="space-y-1.5">
                <FieldHint>{LLM_FIELD_HINTS.boostedKeywords}</FieldHint>
                <Textarea
                  id="retell-boosted-keywords"
                  value={boostedKeywords}
                  onChange={(event) =>
                    onBoostedKeywordsChange(event.target.value)
                  }
                  className="min-h-[120px] text-xs"
                  placeholder={
                    "Medicare Advantage\nFinal Expense\nMutual of Omaha\nyour agency name"
                  }
                />
              </div>
            </BuilderSection>
          </div>
        </div>
      )}

      {/* Boosted keywords — shown in guided mode too, below the wizard */}
      {mode === "guided" && (
        <BuilderSection
          icon={<Sparkles className="h-4 w-4" />}
          title="Important names, products, or phrases"
          description="Words and phrases the voice recognition should prioritize for accuracy on calls."
        >
          <div className="space-y-1.5">
            <FieldHint>{LLM_FIELD_HINTS.boostedKeywords}</FieldHint>
            <Textarea
              id="retell-boosted-keywords-guided"
              value={boostedKeywords}
              onChange={(event) => onBoostedKeywordsChange(event.target.value)}
              className="min-h-[100px] text-xs"
              placeholder={
                "Medicare Advantage\nFinal Expense\nMutual of Omaha\nyour agency name"
              }
            />
          </div>
        </BuilderSection>
      )}
    </div>
  );
}
