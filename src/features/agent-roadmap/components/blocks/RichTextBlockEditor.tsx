// src/features/agent-roadmap/components/blocks/RichTextBlockEditor.tsx
import { useCallback } from "react";
import { TipTapEditor } from "@/features/email";
import { useDebouncedField } from "@/features/training-modules";
import type { RichTextBlock } from "../../types/contentBlocks";

interface RichTextBlockEditorProps {
  block: RichTextBlock;
  onChange: (updated: RichTextBlock) => void;
}

/**
 * Rich text editor wrapping the shared TipTapEditor. Debounced so keystrokes
 * don't trigger a cache write on every character (the classic "typing glitch"
 * pattern).
 */
export function RichTextBlockEditor({
  block,
  onChange,
}: RichTextBlockEditorProps) {
  const commitHtml = useCallback(
    (html: string) => {
      onChange({ ...block, data: { html } });
    },
    [block, onChange],
  );

  const [localHtml, setLocalHtml] = useDebouncedField<string>(
    block.data.html,
    commitHtml,
  );

  return (
    <TipTapEditor
      content={localHtml}
      onChange={setLocalHtml}
      placeholder="Write instructions, tips, or steps..."
      minHeight="180px"
    />
  );
}
