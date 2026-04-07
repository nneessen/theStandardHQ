// Email Template Builder tab: prompt form → AI generate → editable preview → save to Close.

import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Sparkles,
  RotateCw,
  Check,
  ExternalLink,
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
import {
  useGenerateEmailTemplate,
  useSaveEmailTemplate,
} from "../hooks/useCloseAiBuilder";
import type {
  EmailPromptOptions,
  GeneratedEmailTemplate,
} from "../types/close-ai-builder.types";

export function EmailBuilderTab() {
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [constraints, setConstraints] = useState("");

  const [draft, setDraft] = useState<GeneratedEmailTemplate | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [savedCloseId, setSavedCloseId] = useState<string | null>(null);

  const generate = useGenerateEmailTemplate();
  const save = useSaveEmailTemplate();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the email you want to generate");
      return;
    }
    const options: EmailPromptOptions = {
      tone,
      length,
      audience: audience || undefined,
      constraints: constraints || undefined,
    };
    try {
      const result = await generate.mutateAsync({ prompt, options });
      setDraft(result.template);
      setGenerationId(result.generation_id);
      setSavedCloseId(null);
      toast.success("Email template generated — review and save");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate template",
      );
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      const result = await save.mutateAsync({
        template: draft,
        generationId: generationId ?? undefined,
      });
      setSavedCloseId(result.template.id);
      toast.success("Saved to Close");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleReset = () => {
    setDraft(null);
    setGenerationId(null);
    setSavedCloseId(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Prompt form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Describe the email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="prompt" className="text-xs">
              What should this email accomplish? *
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Follow-up email for a lead who requested an IUL quote 3 days ago but hasn't replied. Ask if they have 15 minutes this week."
              className="min-h-[120px] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="audience" className="text-xs">
                Audience
              </Label>
              <Input
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="New IUL quote leads"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tone" className="text-xs">
                Tone
              </Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger id="tone" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="empathetic">Empathetic</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="length" className="text-xs">
              Length
            </Label>
            <Select
              value={length}
              onValueChange={(v) => setLength(v as typeof length)}
            >
              <SelectTrigger id="length" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short (under 100 words)</SelectItem>
                <SelectItem value="medium">Medium (100-200 words)</SelectItem>
                <SelectItem value="long">Long (200-400 words)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="constraints" className="text-xs">
              Extra constraints (optional)
            </Label>
            <Textarea
              id="constraints"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="e.g. Must include a PS line. Avoid mentioning premium amounts."
              className="min-h-[60px] text-sm"
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
                title="Regenerate from the same prompt"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview + edit + save */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Preview & edit</CardTitle>
            {savedCloseId && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              >
                <Check className="mr-1 h-3 w-3" />
                Saved to Close
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!draft ? (
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-center">
              <p className="text-sm text-muted-foreground">
                Generate a template to see the preview here.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="tname" className="text-xs">
                  Template name
                </Label>
                <Input
                  id="tname"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tsubject" className="text-xs">
                  Subject
                </Label>
                <Input
                  id="tsubject"
                  value={draft.subject}
                  onChange={(e) =>
                    setDraft({ ...draft, subject: e.target.value })
                  }
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tbody" className="text-xs">
                  Body
                </Label>
                <Textarea
                  id="tbody"
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  className="min-h-[260px] font-mono text-xs"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={save.isPending || !!savedCloseId}
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
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      title="Open in Close"
                    >
                      <a
                        href={`https://app.close.com/settings/email_templates/`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      New
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
