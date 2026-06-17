// src/features/email/components/template-editor/EmailTemplateEditor.tsx
//
// THE ONE email-template editor. Every surface that builds/edits an email template
// renders THIS component — the Workflows / Training Hub "Email Templates" tab
// (inline master-detail) and the Marketing templates routes (full page). It is
// host-agnostic: the host owns navigation via onClose / onSaved, and passes the
// preview variables for its context. "Generate with AI" is folded in here (it
// drafts → loads into this editor for review/edit → saves), so there is exactly
// one way to build a template and no duplicate editor chrome. Board (.theme-v2).

import { useEffect, useState } from "react";
import { ArrowLeft, Save, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAiAccess } from "@/hooks/subscription";
import type { EmailBlock, EmailTemplateCategory } from "@/types/email.types";
import { EmailBlockBuilder, createBlockFromType } from "../block-builder";
import {
  EMAIL_TEMPLATE_CATEGORIES,
  TEMPLATE_PREVIEW_VARIABLES,
} from "../../constants";
import {
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
} from "../../hooks/useEmailTemplates";
import type { AiEmailDraft } from "../../services/emailTemplateService";
import { EmailTemplateAiDialog } from "./EmailTemplateAiDialog";

export interface EmailTemplateEditorProps {
  /** Existing template id (edit/view), or null when creating. */
  templateId: string | null;
  mode: "create" | "edit" | "view";
  /** Variables shown in the block-builder preview (defaults to the common set). */
  previewVariables?: Record<string, string>;
  /** Show the Global toggle (e.g. only managers). When false, isGlobal = defaultGlobal. */
  allowGlobalToggle?: boolean;
  /** Global value used when the toggle is hidden (e.g. marketing templates are global). */
  defaultGlobal?: boolean;
  /** Open the AI generate dialog immediately (the list's "Generate with AI" entry). */
  autoOpenAi?: boolean;
  /** Host navigates away (back to the list / route). */
  onClose: () => void;
  /** Optional: host gets the saved template id (e.g. to deep-link). */
  onSaved?: (id: string) => void;
}

/** Wrap AI-generated HTML into a single editable text block so it shows in the builder. */
function blocksFromHtml(html: string): EmailBlock[] {
  const block = createBlockFromType("text");
  if (block.content.type === "text") {
    block.content = { ...block.content, html };
  }
  return [block];
}

export function EmailTemplateEditor({
  templateId,
  mode,
  previewVariables = TEMPLATE_PREVIEW_VARIABLES,
  allowGlobalToggle = false,
  defaultGlobal = false,
  autoOpenAi = false,
  onClose,
  onSaved,
}: EmailTemplateEditorProps) {
  const isNew = mode === "create";
  const isViewOnly = mode === "view";

  const shouldFetch = !!templateId && !isNew;
  const {
    data: existingTemplate,
    isLoading: loadingTemplate,
    isError: templateError,
  } = useEmailTemplate(shouldFetch ? templateId : null);

  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const { hasAiAccess } = useAiAccess();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<EmailTemplateCategory>("general");
  const [isGlobal, setIsGlobal] = useState(defaultGlobal);
  const [isActive, setIsActive] = useState(true);
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [showAi, setShowAi] = useState(autoOpenAi && mode === "create");

  // Hydrate the form from the existing template (edit/view).
  useEffect(() => {
    if (existingTemplate && !isNew) {
      setName(existingTemplate.name);
      setSubject(existingTemplate.subject);
      setCategory(existingTemplate.category);
      setIsGlobal(existingTemplate.is_global);
      setIsActive(existingTemplate.is_active);
      // AI-generated templates are HTML-only (no blocks) — surface their body as a
      // single editable text block so the builder isn't blank.
      const existingBlocks = existingTemplate.blocks ?? [];
      setBlocks(
        existingBlocks.length === 0 && existingTemplate.body_html
          ? blocksFromHtml(existingTemplate.body_html)
          : existingBlocks,
      );
    }
  }, [existingTemplate, isNew]);

  function handleGenerated(draft: AiEmailDraft) {
    setName((prev) => (prev.trim() ? prev : draft.name));
    setSubject(draft.subject);
    setBlocks(blocksFromHtml(draft.body_html));
    toast.success("AI draft loaded — review and save it.");
  }

  const isValid = name.trim() && subject.trim();
  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  async function handleSave() {
    if (!isValid) return;
    try {
      if (isNew) {
        const created = await createTemplate.mutateAsync({
          name: name.trim(),
          subject: subject.trim(),
          body_html: "",
          category,
          is_global: isGlobal,
          is_active: true,
          blocks,
          is_block_template: true,
        });
        onSaved?.(created.id);
      } else if (templateId) {
        await updateTemplate.mutateAsync({
          id: templateId,
          updates: {
            name: name.trim(),
            subject: subject.trim(),
            category,
            is_global: isGlobal,
            is_active: isActive,
            blocks,
            is_block_template: true,
          },
        });
        onSaved?.(templateId);
      }
      onClose();
    } catch {
      // The mutation hooks already toast the error; keep the editor open.
    }
  }

  if (!isNew && loadingTemplate) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isNew && shouldFetch && !existingTemplate) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3"
        style={{ color: "var(--mut)" }}
      >
        <p className="font-sans text-[13px]">
          {templateError
            ? "Couldn't load this template — check your connection and try again."
            : "Template not found or unavailable."}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-lg px-4 font-sans text-[13px] font-semibold"
          style={{ background: "var(--surface-3)", color: "var(--ink)" }}
        >
          Back
        </button>
      </div>
    );
  }

  const fieldStyle = {
    background: "var(--surface-1)",
    border: "1px solid var(--line2)",
    color: "var(--ink)",
  } as const;

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--surface-2)" }}
    >
      {/* Header */}
      <div
        className="flex h-12 shrink-0 items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-4)]"
            style={{ color: "var(--mut)" }}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2
            className="font-display text-[15px] font-extrabold uppercase tracking-wide"
            style={{ color: "var(--ink)" }}
          >
            {isViewOnly
              ? "View Template"
              : isNew
                ? "Create Template"
                : "Edit Template"}
          </h2>
        </div>
        {!isViewOnly && (
          <div className="flex items-center gap-2">
            {hasAiAccess && (
              <button
                type="button"
                onClick={() => setShowAi(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 font-sans text-[13px] font-semibold transition-colors hover:bg-[var(--surface-4)]"
                style={{
                  border:
                    "1px solid color-mix(in srgb, var(--violet) 45%, transparent)",
                  color: "var(--violet)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate with AI
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValid || isSaving}
              className="flex h-9 items-center gap-1.5 rounded-lg px-4 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-40"
              style={{ background: "var(--green)", color: "#0a1a0f" }}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isNew ? "Create" : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Settings sidebar */}
        <div
          className="w-56 shrink-0 space-y-4 overflow-y-auto p-4"
          style={{ borderRight: "1px solid var(--line)" }}
        >
          <div className="space-y-1.5">
            <label
              className="font-sans text-[12px] font-semibold"
              style={{ color: "var(--mut)" }}
            >
              Template Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome Email"
              disabled={isViewOnly}
              className="h-9 w-full rounded-lg px-3 font-sans text-[13px] outline-none placeholder:text-[var(--mut2)] disabled:opacity-60"
              style={fieldStyle}
            />
          </div>

          {/* Subject is edited in the builder's subject bar (with variable preview)
              for create/edit; shown read-only in the sidebar for view mode. */}
          {isViewOnly && (
            <div className="space-y-1.5">
              <label
                className="font-sans text-[12px] font-semibold"
                style={{ color: "var(--mut)" }}
              >
                Subject Line
              </label>
              <input
                value={subject}
                disabled
                className="h-9 w-full rounded-lg px-3 font-sans text-[13px] outline-none disabled:opacity-60"
                style={fieldStyle}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label
              className="font-sans text-[12px] font-semibold"
              style={{ color: "var(--mut)" }}
            >
              Category
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as EmailTemplateCategory)
              }
              disabled={isViewOnly}
              className="h-9 w-full rounded-lg px-3 font-sans text-[13px] outline-none disabled:opacity-60"
              style={fieldStyle}
            >
              {EMAIL_TEMPLATE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {!isViewOnly && (allowGlobalToggle || !isNew) && (
            <div className="space-y-2.5 pt-1">
              {allowGlobalToggle && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isGlobal}
                    onChange={(e) => setIsGlobal(e.target.checked)}
                    style={{ accentColor: "var(--blue)" }}
                  />
                  <span
                    className="font-sans text-[12.5px]"
                    style={{ color: "var(--mut)" }}
                  >
                    Global
                  </span>
                </label>
              )}

              {!isNew && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ accentColor: "var(--green)" }}
                  />
                  <span
                    className="font-sans text-[12.5px]"
                    style={{ color: "var(--mut)" }}
                  >
                    Active
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Email builder */}
        <div
          className="flex-1 overflow-hidden"
          style={{ background: "var(--surface-1)" }}
        >
          <EmailBlockBuilder
            blocks={blocks}
            onChange={isViewOnly ? () => {} : setBlocks}
            subject={subject}
            onSubjectChange={isViewOnly ? undefined : setSubject}
            previewVariables={previewVariables}
          />
        </div>
      </div>

      {!isViewOnly && (
        <EmailTemplateAiDialog
          open={showAi}
          onOpenChange={setShowAi}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
}
