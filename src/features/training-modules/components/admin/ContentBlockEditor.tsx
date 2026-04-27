// src/features/training-modules/components/admin/ContentBlockEditor.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Video,
  FileText,
  MessageSquare,
  Type,
  Presentation,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUpdateContentBlock } from "../../hooks/useTrainingLessons";
import type {
  TrainingLessonContent,
  VideoPlatform,
} from "../../types/training-module.types";
// eslint-disable-next-line no-restricted-imports
import { TipTapEditor } from "@/features/email/components/TipTapEditor";
import { useDebouncedField } from "../../hooks/useDebouncedField";
// eslint-disable-next-line no-restricted-imports
import { trainingDocumentService } from "@/features/training-hub/services/trainingDocumentService";
// eslint-disable-next-line no-restricted-imports
import { useTrainingDocument } from "@/features/training-hub/hooks/useTrainingDocuments";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ContentBlockEditorProps {
  block: TrainingLessonContent;
  lessonId: string;
}

/**
 * Detects video platform from URL.
 */
function detectVideoPlatform(url: string): VideoPlatform | null {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/vimeo\.com/.test(url)) return "vimeo";
  if (/loom\.com/.test(url)) return "loom";
  return null;
}

export function ContentBlockEditor({
  block,
  lessonId,
}: ContentBlockEditorProps) {
  const updateBlock = useUpdateContentBlock();

  const update = useCallback(
    (input: Record<string, unknown>) => {
      updateBlock.mutate({ id: block.id, lessonId, input });
    },
    [updateBlock, block.id, lessonId],
  );

  switch (block.content_type) {
    case "rich_text":
      return <RichTextBlock block={block} onUpdate={update} />;
    case "video":
      return <VideoBlock block={block} onUpdate={update} />;
    case "pdf":
      return <PdfBlock block={block} onUpdate={update} />;
    case "slides":
      return <SlidesBlock block={block} onUpdate={update} />;
    case "external_link":
      return <ExternalLinkBlock block={block} onUpdate={update} />;
    case "script_prompt":
      return <ScriptPromptBlock block={block} onUpdate={update} />;
    default:
      return (
        <div className="text-[10px] text-v2-ink-subtle">
          Unknown content type: {block.content_type}
        </div>
      );
  }
}

function RichTextBlock({
  block,
  onUpdate,
}: {
  block: TrainingLessonContent;
  onUpdate: (input: Record<string, unknown>) => void;
}) {
  // TipTap owns its own editor state once mounted. We capture the initial
  // content on first render via a ref and never resync from props, so any
  // query-cache churn during typing cannot reset the cursor. The parent
  // SortableContentBlock is keyed on `block.id`, so switching to a different
  // block remounts this component and re-initializes the ref naturally.
  const initialContentRef = useRef(block.rich_text_content || "");

  // Debounce rich text saves (TipTap fires onChange frequently)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChange = useCallback(
    (html: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onUpdate({ rich_text_content: html });
      }, 500);
    },
    [onUpdate],
  );
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] text-v2-ink-muted mb-1">
        <Type className="h-3 w-3" />
        Rich Text
      </div>
      <TipTapEditor
        content={initialContentRef.current}
        onChange={handleChange}
        placeholder="Write your content here..."
        minHeight="120px"
      />
    </div>
  );
}

function VideoBlock({
  block,
  onUpdate,
}: {
  block: TrainingLessonContent;
  onUpdate: (input: Record<string, unknown>) => void;
}) {
  const saveUrl = useCallback(
    (newUrl: string) => {
      const platform = detectVideoPlatform(newUrl);
      onUpdate({ video_url: newUrl || null, video_platform: platform });
    },
    [onUpdate],
  );
  const [url, setUrl] = useDebouncedField(block.video_url || "", saveUrl);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-[10px] text-v2-ink-muted">
        <Video className="h-3 w-3" />
        Video URL
      </div>
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://youtube.com/watch?v=... or Vimeo/Loom URL"
        className="h-7 text-xs"
      />
      {block.video_platform && (
        <span className="text-[10px] text-v2-ink-subtle">
          Platform detected: {block.video_platform}
        </span>
      )}
    </div>
  );
}

/**
 * PDF block with file upload via trainingDocumentService
 */
function PdfBlock({
  block,
  onUpdate,
}: {
  block: TrainingLessonContent;
  onUpdate: (input: Record<string, unknown>) => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { data: existingDoc } = useTrainingDocument(
    block.document_id || undefined,
  );

  const handleUpload = useCallback(
    async (file: File) => {
      if (!user?.id) return;
      setUploading(true);
      try {
        const doc = await trainingDocumentService.upload({
          file,
          name: file.name,
          category: "training",
          uploadedBy: user.id,
        });
        onUpdate({ document_id: doc.id });
        toast.success("PDF uploaded");
      } catch (err) {
        toast.error(
          `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setUploading(false);
      }
    },
    [user, onUpdate],
  );

  const handleRemove = useCallback(() => {
    onUpdate({ document_id: null });
  }, [onUpdate]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-[10px] text-v2-ink-muted">
        <FileText className="h-3 w-3" />
        PDF Document
      </div>

      {existingDoc ? (
        <div className="flex items-center gap-2 p-2 rounded border border-v2-ring dark:border-v2-ring-strong bg-v2-canvas dark:bg-v2-card-tinted/50">
          <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{existingDoc.name}</p>
            <p className="text-[10px] text-v2-ink-muted">
              {((existingDoc.fileSize || 0) / 1024).toFixed(0)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          className="border-2 border-dashed border-v2-ring-strong dark:border-v2-ring-strong rounded p-4 text-center cursor-pointer hover:border-v2-ring-strong dark:hover:border-v2-ring-strong transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mx-auto animate-spin text-v2-ink-subtle" />
          ) : (
            <>
              <Upload className="h-4 w-4 mx-auto mb-1 text-v2-ink-subtle" />
              <p className="text-[10px] text-v2-ink-subtle">
                Click to upload a PDF
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Slides block — accepts PDF upload for slide-based viewing
 */
function SlidesBlock({
  block,
  onUpdate,
}: {
  block: TrainingLessonContent;
  onUpdate: (input: Record<string, unknown>) => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { data: existingDoc } = useTrainingDocument(
    block.document_id || undefined,
  );

  const handleUpload = useCallback(
    async (file: File) => {
      if (!user?.id) return;
      setUploading(true);
      try {
        const doc = await trainingDocumentService.upload({
          file,
          name: file.name,
          category: "training",
          uploadedBy: user.id,
        });
        onUpdate({ document_id: doc.id });
        toast.success("Slides uploaded");
      } catch (err) {
        toast.error(
          `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      } finally {
        setUploading(false);
      }
    },
    [user, onUpdate],
  );

  const handleRemove = useCallback(() => {
    onUpdate({ document_id: null });
  }, [onUpdate]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-[10px] text-v2-ink-muted">
        <Presentation className="h-3 w-3" />
        Slides (PDF)
      </div>

      {existingDoc ? (
        <div className="flex items-center gap-2 p-2 rounded border border-v2-ring dark:border-v2-ring-strong bg-v2-canvas dark:bg-v2-card-tinted/50">
          <Presentation className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{existingDoc.name}</p>
            <p className="text-[10px] text-v2-ink-muted">
              {((existingDoc.fileSize || 0) / 1024).toFixed(0)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          className="border-2 border-dashed border-v2-ring-strong dark:border-v2-ring-strong rounded p-4 text-center cursor-pointer hover:border-v2-ring-strong dark:hover:border-v2-ring-strong transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mx-auto animate-spin text-v2-ink-subtle" />
          ) : (
            <>
              <Upload className="h-4 w-4 mx-auto mb-1 text-v2-ink-subtle" />
              <p className="text-[10px] text-v2-ink-subtle">
                Upload PDF slides
              </p>
              <p className="text-[9px] text-v2-ink-subtle mt-0.5">
                For best results, export PowerPoint as PDF
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ExternalLinkBlock({
  block,
  onUpdate,
}: {
  block: TrainingLessonContent;
  onUpdate: (input: Record<string, unknown>) => void;
}) {
  const saveUrl = useCallback(
    (v: string) => onUpdate({ external_url: v || null }),
    [onUpdate],
  );
  const saveLabel = useCallback(
    (v: string) => onUpdate({ external_url_label: v || null }),
    [onUpdate],
  );
  const [localUrl, setLocalUrl] = useDebouncedField(
    block.external_url || "",
    saveUrl,
  );
  const [localLabel, setLocalLabel] = useDebouncedField(
    block.external_url_label || "",
    saveLabel,
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-[10px] text-v2-ink-muted">
        <ExternalLink className="h-3 w-3" />
        External Link
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-v2-ink-subtle">URL</label>
          <Input
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-v2-ink-subtle">Label</label>
          <Input
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            placeholder="Click here to learn more"
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function ScriptPromptBlock({
  block,
  onUpdate,
}: {
  block: TrainingLessonContent;
  onUpdate: (input: Record<string, unknown>) => void;
}) {
  const savePrompt = useCallback(
    (v: string) => onUpdate({ script_prompt_text: v || null }),
    [onUpdate],
  );
  const saveInstructions = useCallback(
    (v: string) => onUpdate({ script_prompt_instructions: v || null }),
    [onUpdate],
  );
  const [localPrompt, setLocalPrompt] = useDebouncedField(
    block.script_prompt_text || "",
    savePrompt,
  );
  const [localInstructions, setLocalInstructions] = useDebouncedField(
    block.script_prompt_instructions || "",
    saveInstructions,
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-[10px] text-v2-ink-muted">
        <MessageSquare className="h-3 w-3" />
        Script Prompt
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-v2-ink-subtle">Prompt Text</label>
        <textarea
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          rows={3}
          className="w-full text-xs rounded-md border border-v2-ring dark:border-v2-ring-strong bg-v2-card p-2 resize-none"
          placeholder="The script the agent should practice saying..."
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-v2-ink-subtle">Instructions</label>
        <textarea
          value={localInstructions}
          onChange={(e) => setLocalInstructions(e.target.value)}
          rows={2}
          className="w-full text-xs rounded-md border border-v2-ring dark:border-v2-ring-strong bg-v2-card p-2 resize-none"
          placeholder="Instructions for the agent (tone, emphasis, objection handling)..."
        />
      </div>
    </div>
  );
}
