// SMS Template Builder tab.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Sparkles,
  RotateCw,
  Check,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  useGenerateSmsTemplate,
  useSaveSmsTemplate,
} from "../hooks/useCloseAiBuilder";
import { enforceStopFooter } from "../lib/stop-footer";
import type {
  GeneratedSmsTemplate,
  SmsPromptOptions,
} from "../types/close-ai-builder.types";

export function SmsBuilderTab() {
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("casual");
  const [maxChars, setMaxChars] = useState(320);
  const [includeStop, setIncludeStop] = useState(true);
  const [constraints, setConstraints] = useState("");

  const [draft, setDraft] = useState<GeneratedSmsTemplate | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [savedCloseId, setSavedCloseId] = useState<string | null>(null);

  const generate = useGenerateSmsTemplate();
  const save = useSaveSmsTemplate();

  // Mirror includeStop into a ref so async handlers (handleGenerate)
  // post-process the AI result against the LATEST toggle state — not the
  // closure-captured value at submit time. Without this, toggling between
  // submit and AI response causes the visible toggle to disagree with the
  // body content the user sees.
  const includeStopRef = useRef(includeStop);
  useEffect(() => {
    includeStopRef.current = includeStop;
  }, [includeStop]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the SMS you want to generate");
      return;
    }
    const options: SmsPromptOptions = {
      tone,
      audience: audience || undefined,
      maxChars,
      includeStop,
      constraints: constraints || undefined,
    };
    try {
      const result = await generate.mutateAsync({ prompt, options });
      setDraft({
        ...result.template,
        // Read CURRENT toggle state; the user may have flipped while the AI
        // request was in flight.
        text: enforceStopFooter(result.template.text, includeStopRef.current),
      });
      setGenerationId(result.generation_id);
      setSavedCloseId(null);
      toast.success("SMS template generated — review and save");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate template",
      );
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    const finalText = enforceStopFooter(draft.text, includeStop);
    if (finalText.length > maxChars) {
      // Defense in depth: the disabled-button gate already uses the
      // post-enforcement length, but a save can still race with a setDraft
      // that hasn't flushed. Refuse rather than ship an over-budget SMS that
      // splits across extra carrier segments.
      toast.error(
        `SMS exceeds ${maxChars}-char budget after STOP footer enforcement (${finalText.length} chars). Trim the body or raise the limit.`,
      );
      return;
    }
    const templateToSave =
      finalText === draft.text ? draft : { ...draft, text: finalText };
    if (templateToSave !== draft) {
      // Reflect the enforcement in the visible draft so the user sees what's
      // actually being saved (no surprise diff between preview and Close).
      setDraft(templateToSave);
    }
    try {
      const result = await save.mutateAsync({
        template: templateToSave,
        generationId: generationId ?? undefined,
      });
      setSavedCloseId(result.template.id);
      toast.success("Saved to Close");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  // Toggle handler: when the user flips the Reply STOP switch with a draft on
  // screen, immediately reconcile the visible text so the toggle is observably
  // doing what it says. Idempotent — safe even if the body already matches.
  const handleIncludeStopChange = (next: boolean) => {
    setIncludeStop(next);
    if (draft && !savedCloseId) {
      setDraft({ ...draft, text: enforceStopFooter(draft.text, next) });
    }
  };

  const handleReset = () => {
    setDraft(null);
    setGenerationId(null);
    setSavedCloseId(null);
  };

  // Use the POST-ENFORCEMENT length for the visible counter and the save-
  // button gate. The user-visible textarea may not yet reflect the appended
  // footer (e.g., they edited it out), but enforcement runs at save — so
  // this is what will actually ship to Close.
  const liveText = draft?.text ?? "";
  const finalText = enforceStopFooter(liveText, includeStop);
  const charCount = finalText.length;
  const overBudget = charCount > maxChars;
  const willAppendFooter = finalText !== liveText;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Prompt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-info" />
            Describe the SMS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sms-prompt" className="text-xs">
              What should this SMS say? *
            </Label>
            <Textarea
              id="sms-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Quick check-in text for a lead who booked a call last week but didn't show up. Friendly re-engagement."
              className="min-h-[100px] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sms-audience" className="text-xs">
                Audience
              </Label>
              <Input
                id="sms-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="No-show callbacks"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sms-tone" className="text-xs">
                Tone
              </Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger id="sms-tone" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sms-max" className="text-xs">
                Max characters
              </Label>
              <Select
                value={String(maxChars)}
                onValueChange={(v) => setMaxChars(Number(v))}
              >
                <SelectTrigger id="sms-max" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="160">160 (1 segment)</SelectItem>
                  <SelectItem value="320">320 (2 segments)</SelectItem>
                  <SelectItem value="480">480 (3 segments)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Switch
                id="sms-stop"
                checked={includeStop}
                onCheckedChange={handleIncludeStopChange}
              />
              <Label htmlFor="sms-stop" className="cursor-pointer text-xs">
                Include "Reply STOP" footer
              </Label>
            </div>
          </div>

          {!includeStop && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] dark:border-destructive/60 dark:bg-destructive/15">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-destructive dark:text-destructive">
                <span className="font-semibold">
                  TCPA / CTIA compliance warning.
                </span>{" "}
                Marketing SMS without an opt-out footer may violate U.S. carrier
                guidelines and TCPA. You are responsible for ensuring this
                template is only used in contexts that don't require an opt-out
                (e.g. confirmed transactional messages).
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sms-constraints" className="text-xs">
              Extra constraints (optional)
            </Label>
            <Textarea
              id="sms-constraints"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="e.g. Mention our next availability slot"
              className="min-h-[50px] text-sm"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleGenerate}
              disabled={generate.isPending || !prompt.trim()}
              size="sm"
              className="flex-1"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Generate with AI
                </>
              )}
            </Button>
            {draft && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generate.isPending}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Preview & edit</CardTitle>
            {savedCloseId && (
              <Badge
                variant="outline"
                className="border-success/40 text-success"
              >
                <Check className="mr-1 h-3 w-3" />
                Saved
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!draft ? (
            <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed text-center">
              <p className="text-sm text-muted-foreground">
                Generate an SMS template to see the preview here.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="sms-tname" className="text-xs">
                  Template name
                </Label>
                <Input
                  id="sms-tname"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sms-ttext" className="text-xs">
                    SMS body
                  </Label>
                  <span
                    className={`text-[11px] tabular-nums ${
                      overBudget
                        ? "text-destructive"
                        : charCount > maxChars * 0.9
                          ? "text-warning"
                          : "text-muted-foreground"
                    }`}
                    title={
                      willAppendFooter
                        ? `Includes +${finalText.length - liveText.length} chars from STOP footer that will be appended at save`
                        : undefined
                    }
                  >
                    {charCount} / {maxChars}
                    {willAppendFooter ? "*" : ""}
                  </span>
                </div>
                <Textarea
                  id="sms-ttext"
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                  className="min-h-[200px] font-mono text-xs"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={save.isPending || !!savedCloseId || overBudget}
                  size="sm"
                  className="flex-1"
                >
                  {save.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : savedCloseId ? (
                    <>
                      <Check className="mr-2 h-3.5 w-3.5" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-3.5 w-3.5" />
                      Save to Close
                    </>
                  )}
                </Button>
                {savedCloseId && (
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    New
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
