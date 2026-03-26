import { Mic2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatBotRetellVoice } from "@/features/chat-bot";
import { BuilderSection } from "./BuilderSection";

function StepChecklistItem({
  label,
  complete,
  detail,
}: {
  label: string;
  complete: boolean;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3",
        complete
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
          : "border-border/60 bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
          {label}
        </p>
        <Badge
          className={cn(
            "text-[9px] flex-shrink-0",
            complete
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
          )}
        >
          {complete ? "Ready" : "Needs attention"}
        </Badge>
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-zinc-600 dark:text-zinc-400">
        {detail}
      </p>
    </div>
  );
}

interface LaunchViewProps {
  voiceReady: boolean;
  openingLineReady: boolean;
  instructionsReady: boolean;
  isPublished: boolean;
  selectedVoiceId: string;
  selectedVoice: ChatBotRetellVoice | undefined;
  workflowGreetings: Record<string, string>;
  lastModifiedAt?: number | null;
  justPublished?: boolean;
}

function formatPublishTime(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(epochMs).toLocaleDateString();
}

export function LaunchView({
  voiceReady,
  openingLineReady,
  instructionsReady,
  isPublished,
  selectedVoiceId,
  selectedVoice,
  workflowGreetings,
  lastModifiedAt,
  justPublished,
}: LaunchViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <BuilderSection
        icon={<UploadCloud className="h-4 w-4" />}
        title="Review your draft"
        description="Make sure the most important launch items are ready before you publish the agent live."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StepChecklistItem
            label="Voice selected"
            complete={voiceReady}
            detail={
              voiceReady
                ? selectedVoice?.voice_name || selectedVoiceId
                : "Choose a voice in Step 1 before publishing."
            }
          />
          <StepChecklistItem
            label="Opening line"
            complete={openingLineReady}
            detail={
              openingLineReady
                ? "Per-workflow greetings are configured."
                : "Add greetings for each call type in Step 1."
            }
          />
          <StepChecklistItem
            label="Instructions written"
            complete={instructionsReady}
            detail={
              instructionsReady
                ? "The draft includes the operating instructions for the call."
                : "Add the prompt and behavior guidance in Step 2."
            }
          />
          <StepChecklistItem
            label="Current live state"
            complete={isPublished}
            detail={
              isPublished
                ? justPublished
                  ? "Just published \u2014 your latest draft is now live."
                  : lastModifiedAt
                    ? `Published ${formatPublishTime(lastModifiedAt)}. Your live agent is running this version.`
                    : "A published version is already live."
                : "This workspace still needs a published draft to go live."
            }
          />
        </div>
      </BuilderSection>

      <div className="space-y-4">
        <BuilderSection
          icon={<Mic2 className="h-4 w-4" />}
          title="Current draft snapshot"
          description="A quick read of the draft you are about to publish."
        >
          <div className="space-y-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Voice
              </p>
              <p className="mt-1 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedVoice
                  ? `${selectedVoice.voice_name} · ${selectedVoice.provider}`
                  : selectedVoiceId || "No voice selected"}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Opening line
              </p>
              <p className="mt-1 text-[11px] text-zinc-900 dark:text-zinc-100">
                {openingLineReady
                  ? `${Object.values(workflowGreetings).filter((g) => g.trim()).length}/5 workflow greetings configured`
                  : "No greetings saved yet."}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Prompt status
              </p>
              <p className="mt-1 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                {instructionsReady
                  ? "Instructions are saved in the draft."
                  : "Instructions still need to be added."}
              </p>
            </div>
          </div>
        </BuilderSection>

        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-[11px] font-bold text-foreground">Publish flow</p>
          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
            Publishing makes your latest saved draft the live version that
            callers hear. If you changed anything in Steps 1–4, make sure you
            saved the draft first. You can publish as many times as you want —
            each publish overwrites the previous live version.
          </p>
        </div>
      </div>
    </div>
  );
}
