// src/features/agent-roadmap/components/blocks/CalloutBlockEditor.tsx
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useDebouncedField } from "@/features/training-modules";
import type { CalloutBlock, CalloutVariant } from "../../types/contentBlocks";
import { CalloutBlockView } from "./CalloutBlockView";

interface CalloutBlockEditorProps {
  block: CalloutBlock;
  onChange: (updated: CalloutBlock) => void;
}

export function CalloutBlockEditor({
  block,
  onChange,
}: CalloutBlockEditorProps) {
  const commitTitle = useCallback(
    (title: string) => {
      onChange({
        ...block,
        data: { ...block.data, title: title || undefined },
      });
    },
    [block, onChange],
  );
  const commitBody = useCallback(
    (body: string) => {
      onChange({ ...block, data: { ...block.data, body } });
    },
    [block, onChange],
  );

  const [titleLocal, setTitleLocal] = useDebouncedField(
    block.data.title ?? "",
    commitTitle,
  );
  const [bodyLocal, setBodyLocal] = useDebouncedField(
    block.data.body,
    commitBody,
  );

  function handleVariantChange(variant: CalloutVariant) {
    onChange({ ...block, data: { ...block.data, variant } });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
        <div className="space-y-1">
          <Label htmlFor={`variant-${block.id}`} className="text-xs">
            Style
          </Label>
          <Select
            value={block.data.variant}
            onValueChange={handleVariantChange}
          >
            <SelectTrigger id={`variant-${block.id}`} className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="tip">Tip</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="success">Success</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`title-${block.id}`} className="text-xs">
            Title (optional)
          </Label>
          <Input
            id={`title-${block.id}`}
            value={titleLocal}
            onChange={(e) => setTitleLocal(e.target.value)}
            placeholder="Heads up"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`body-${block.id}`} className="text-xs">
          Body
        </Label>
        <Textarea
          id={`body-${block.id}`}
          value={bodyLocal}
          onChange={(e) => setBodyLocal(e.target.value)}
          placeholder="What the agent needs to know"
          rows={3}
          className="text-sm resize-none"
        />
      </div>
      {bodyLocal && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
            Preview
          </div>
          <CalloutBlockView
            block={{
              ...block,
              data: {
                ...block.data,
                title: titleLocal || undefined,
                body: bodyLocal,
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
