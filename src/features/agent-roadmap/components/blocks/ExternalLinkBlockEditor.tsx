// src/features/agent-roadmap/components/blocks/ExternalLinkBlockEditor.tsx
import { useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedField } from "@/features/training-modules";
import type { ExternalLinkBlock } from "../../types/contentBlocks";
import { ExternalLinkBlockView } from "./ExternalLinkBlockView";

interface ExternalLinkBlockEditorProps {
  block: ExternalLinkBlock;
  onChange: (updated: ExternalLinkBlock) => void;
}

// L-3: We deliberately do NOT fetch favicons from google.com/s2/favicons
// anymore. That URL leaked every external link an admin published to Google
// Analytics — a privacy regression for confidential partner URLs. The
// view component uses a lucide icon fallback instead.

export function ExternalLinkBlockEditor({
  block,
  onChange,
}: ExternalLinkBlockEditorProps) {
  const commitUrl = useCallback(
    (url: string) => {
      onChange({
        ...block,
        data: { ...block.data, url, favicon: undefined },
      });
    },
    [block, onChange],
  );

  const commitLabel = useCallback(
    (label: string) => {
      onChange({ ...block, data: { ...block.data, label } });
    },
    [block, onChange],
  );

  const commitDescription = useCallback(
    (description: string) => {
      onChange({
        ...block,
        data: { ...block.data, description: description || undefined },
      });
    },
    [block, onChange],
  );

  const [urlLocal, setUrlLocal] = useDebouncedField(block.data.url, commitUrl);
  const [labelLocal, setLabelLocal] = useDebouncedField(
    block.data.label,
    commitLabel,
  );
  const [descriptionLocal, setDescriptionLocal] = useDebouncedField(
    block.data.description ?? "",
    commitDescription,
  );

  const previewBlock = useMemo<ExternalLinkBlock>(
    () => ({
      ...block,
      data: {
        url: urlLocal,
        label: labelLocal || urlLocal || "Untitled link",
        description: descriptionLocal || undefined,
        favicon: block.data.favicon,
      },
    }),
    [block, urlLocal, labelLocal, descriptionLocal],
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`url-${block.id}`} className="text-xs">
            URL
          </Label>
          <Input
            id={`url-${block.id}`}
            value={urlLocal}
            onChange={(e) => setUrlLocal(e.target.value)}
            placeholder="https://app.close.com/..."
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`label-${block.id}`} className="text-xs">
            Label
          </Label>
          <Input
            id={`label-${block.id}`}
            value={labelLocal}
            onChange={(e) => setLabelLocal(e.target.value)}
            placeholder="e.g. 'Open Close CRM'"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`desc-${block.id}`} className="text-xs">
            Description (optional)
          </Label>
          <Input
            id={`desc-${block.id}`}
            value={descriptionLocal}
            onChange={(e) => setDescriptionLocal(e.target.value)}
            placeholder="Short note about what agents will find here"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {urlLocal && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Preview
          </div>
          <ExternalLinkBlockView block={previewBlock} />
        </div>
      )}
    </div>
  );
}
