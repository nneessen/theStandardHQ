// src/features/email/components/template-editor/EmailTemplateAiDialog.tsx
//
// AI email-draft generator, opened from INSIDE the one shared email-template
// editor. Starter-prompt chips + a prompt box → the generate-workflow-email-template
// edge fn (which gates AI access + rate limits server-side and returns a DRAFT).
// The draft is handed back to the editor via onGenerated for review/edit/save —
// it is NOT persisted here, so there is a single build+save path. Board styled.

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WORKFLOW_EMAIL_STARTER_PROMPTS } from "@/lib/workflow-email-starter-prompts";
import { useGenerateAiEmailTemplateDraft } from "../../hooks/useEmailTemplates";
import type { AiEmailDraft } from "../../services/emailTemplateService";

/** Board accent tint (color-mix alpha fill). */
const tint = (v: string, pct: number) =>
  `color-mix(in srgb, var(${v}) ${pct}%, transparent)`;

interface EmailTemplateAiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the generated draft so the editor can load it for review/edit. */
  onGenerated: (draft: AiEmailDraft) => void;
}

export function EmailTemplateAiDialog({
  open,
  onOpenChange,
  onGenerated,
}: EmailTemplateAiDialogProps) {
  const [prompt, setPrompt] = useState("");
  const generate = useGenerateAiEmailTemplateDraft();

  const submit = () => {
    if (!prompt.trim() || generate.isPending) return;
    generate.mutate(
      { prompt: prompt.trim() },
      {
        onSuccess: (draft) => {
          setPrompt("");
          onGenerated(draft);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="block gap-0 border-0 p-0 shadow-none sm:max-w-none"
        style={{
          width: 620,
          maxWidth: "94vw",
          borderRadius: 20,
          background: "var(--surface-2)",
          border: "1px solid var(--line2)",
          boxShadow: "var(--panelshadow)",
          overflow: "hidden",
        }}
      >
        {/* Head */}
        <div
          className="px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: tint("--violet", 14),
                color: "var(--violet)",
              }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle
                className="font-display text-[19px] font-extrabold uppercase tracking-wide"
                style={{ color: "var(--ink)" }}
              >
                Generate Email with AI
              </DialogTitle>
              <DialogDescription
                className="font-sans text-[13.5px]"
                style={{ color: "var(--mut)" }}
              >
                Describe the email — AI drafts it, then you review and edit it
                here before saving.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p
            className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--mut2)" }}
          >
            Starter ideas
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {WORKFLOW_EMAIL_STARTER_PROMPTS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setPrompt(s.prompt)}
                disabled={generate.isPending}
                className="rounded-lg px-3 py-1.5 font-sans text-[12.5px] transition-colors hover:bg-[var(--surface-4)] disabled:opacity-50"
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--line)",
                  color: "var(--mut)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="e.g. Welcome a newly licensed agent and tell them their upline will reach out to schedule onboarding…"
            className="w-full rounded-xl p-3.5 font-sans text-[14px] outline-none placeholder:text-[var(--mut2)]"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--line2)",
              color: "var(--ink)",
              resize: "vertical",
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
          />
        </div>

        {/* Foot */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-lg px-4 font-sans text-[13px] font-semibold transition-colors hover:bg-[var(--surface-4)]"
            style={{ color: "var(--mut)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!prompt.trim() || generate.isPending}
            className="flex h-9 items-center gap-1.5 rounded-lg px-5 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--violet)", color: "#1a1430" }}
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generate.isPending ? "Generating…" : "Generate"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
