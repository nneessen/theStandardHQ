// src/features/agent-roadmap/components/blocks/CodeSnippetBlockEditor.tsx
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useDebouncedField } from "@/features/training-modules";
import type { CodeSnippetBlock } from "../../types/contentBlocks";

interface CodeSnippetBlockEditorProps {
  block: CodeSnippetBlock;
  onChange: (updated: CodeSnippetBlock) => void;
}

export function CodeSnippetBlockEditor({
  block,
  onChange,
}: CodeSnippetBlockEditorProps) {
  const commitCode = useCallback(
    (code: string) => {
      onChange({ ...block, data: { ...block.data, code } });
    },
    [block, onChange],
  );
  const commitLabel = useCallback(
    (label: string) => {
      onChange({
        ...block,
        data: { ...block.data, label: label || undefined },
      });
    },
    [block, onChange],
  );

  const [codeLocal, setCodeLocal] = useDebouncedField(
    block.data.code,
    commitCode,
  );
  const [labelLocal, setLabelLocal] = useDebouncedField(
    block.data.label ?? "",
    commitLabel,
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`label-${block.id}`} className="text-xs">
          Label (optional)
        </Label>
        <Input
          id={`label-${block.id}`}
          value={labelLocal}
          onChange={(e) => setLabelLocal(e.target.value)}
          placeholder="e.g. 'Run this in Terminal'"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`code-${block.id}`} className="text-xs">
          Code
        </Label>
        <Textarea
          id={`code-${block.id}`}
          value={codeLocal}
          onChange={(e) => setCodeLocal(e.target.value)}
          placeholder="Paste commands, URLs, or config snippets"
          rows={5}
          className="text-xs font-mono resize-y bg-[#0d1117] text-zinc-100 border-zinc-800"
        />
      </div>
    </div>
  );
}
