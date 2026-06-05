import { useState } from "react";
import { HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CAPABILITY_GROUPS } from "../lib/capabilities";
import { DEFAULT_ACCENT } from "../lib/agentTheme";

interface Props {
  /** Send an example prompt as if the user typed it. Sheet closes after. */
  onRun: (text: string) => void;
  assistantName?: string;
  accent?: string;
}

/**
 * The in-app Jarvis guide: a "?" in the command bar opens a grounded reference of what Jarvis
 * can actually do, grouped by area, with click-to-run example prompts. Content comes from the
 * shared capabilities source (lib/capabilities.ts), which mirrors the real orchestrator tools —
 * so nothing here is aspirational or invented.
 */
export function CapabilitiesSheet({
  onRun,
  assistantName = "Jarvis",
  accent = DEFAULT_ACCENT,
}: Props) {
  const [open, setOpen] = useState(false);

  const run = (prompt: string) => {
    onRun(prompt);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`What can ${assistantName} do?`}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>What can {assistantName} do?</SheetTitle>
          <SheetDescription>
            Ask in plain language — by voice or text. Tap any example to run it.
            Every answer is grounded in your real data, and {assistantName}{" "}
            never sends a message without your approval.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-5">
          {CAPABILITY_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {group.title}
                </h3>
                <p className="text-xs text-muted-foreground">{group.blurb}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {group.examples.map((ex) => (
                  <button
                    key={ex.prompt}
                    type="button"
                    onClick={() => run(ex.prompt)}
                    className="group inline-flex items-start gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-transparent hover:text-foreground"
                    style={{ ["--accent" as string]: accent }}
                  >
                    <Sparkles
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: accent }}
                    />
                    <span>{ex.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
