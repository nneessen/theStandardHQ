import { useState, type ReactNode } from "react";
import { ChevronDown, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { LLM_FIELD_HINTS } from "../../lib/retell-field-hints";
import {
  VOICE_AGENT_INSTRUCTION_TEMPLATE,
  INSTRUCTION_TEMPLATE_SECTIONS,
} from "../../lib/retell-instruction-template";
import { FieldHint } from "./FieldHint";

function BuilderSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {icon}
        </div>
        <div>
          <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </p>
          <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

interface InstructionsViewProps {
  generalPrompt: string;
  onGeneralPromptChange: (value: string) => void;
  boostedKeywords: string;
  onBoostedKeywordsChange: (value: string) => void;
  llmAvailable: boolean;
  llmLoading: boolean;
}

export function InstructionsView({
  generalPrompt,
  onGeneralPromptChange,
  boostedKeywords,
  onBoostedKeywordsChange,
  llmAvailable,
  llmLoading,
}: InstructionsViewProps) {
  const [exampleOpen, setExampleOpen] = useState(false);

  const handleUseTemplate = () => {
    if (generalPrompt.trim().length > 0) return;
    onGeneralPromptChange(VOICE_AGENT_INSTRUCTION_TEMPLATE);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <BuilderSection
        icon={<Sparkles className="h-4 w-4" />}
        title="What should this agent do?"
        description="Describe the role clearly in plain language, including what it should say, what it should collect, and when it should transfer the caller."
      >
        {!llmAvailable && !llmLoading ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            Prompt editing becomes available when this workspace is using the
            managed voice model setup.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="retell-general-prompt">
                Voice agent instructions
              </Label>
              <FieldHint>{LLM_FIELD_HINTS.generalPrompt}</FieldHint>
              <Textarea
                id="retell-general-prompt"
                value={generalPrompt}
                onChange={(event) => onGeneralPromptChange(event.target.value)}
                className="min-h-[260px] text-xs"
                placeholder={
                  "## Identity\nYou are [Agent Name], a friendly assistant at [Your Agency Name].\n\n## What to ask\n1. What type of coverage are you looking for?\n2. What state do you live in?\n\n## When to transfer\nTransfer when the caller asks for a specific person or is ready for a quote."
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retell-boosted-keywords">
                Important names, products, or phrases
              </Label>
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
          </div>
        )}
      </BuilderSection>

      <div className="space-y-4">
        {/* Collapsible example template */}
        <Collapsible
          open={exampleOpen}
          onOpenChange={setExampleOpen}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                See an example
              </p>
              <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                A ready-to-use template for an insurance voice agent.
              </p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    exampleOpen ? "rotate-180" : "rotate-0",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <pre className="whitespace-pre-wrap text-[10px] leading-5 text-zinc-700 dark:text-zinc-300 max-h-[360px] overflow-y-auto overscroll-contain">
              {VOICE_AGENT_INSTRUCTION_TEMPLATE}
            </pre>
            <div className="mt-3 flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleUseTemplate}
                disabled={generalPrompt.trim().length > 0}
              >
                <Copy className="h-3 w-3" />
                Use this template
              </Button>
              {generalPrompt.trim().length > 0 && (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Clear the instructions box first to use the template.
                </p>
              )}
            </div>
            <p className="mt-2 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
              This is a starting point. Replace the [bracketed] placeholders
              with your agency's details.
            </p>
          </CollapsibleContent>
        </Collapsible>

        {/* Section-by-section writing guide */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            What to include
          </p>
          <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
            Cover each of these areas in your instructions:
          </p>
          <ul className="mt-3 space-y-2">
            {INSTRUCTION_TEMPLATE_SECTIONS.map((section) => (
              <li key={section.title} className="flex gap-2">
                <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 flex-shrink-0">
                  {section.title}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  — {section.hint}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
