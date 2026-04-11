// src/features/agent-roadmap/components/blocks/BlockTypePickerMenu.tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Type,
  Image as ImageIcon,
  Film,
  Link2,
  Info,
  Code2,
} from "lucide-react";
import type {
  RoadmapContentBlock,
  RoadmapContentBlockType,
} from "../../types/contentBlocks";

interface BlockTypePickerMenuProps {
  /** Called when the user picks a block type. Parent creates the block. */
  onPick: (type: RoadmapContentBlockType) => void;
  /** Disable when max blocks reached, etc. */
  disabled?: boolean;
}

const BLOCK_OPTIONS: Array<{
  type: RoadmapContentBlockType;
  label: string;
  description: string;
  icon: typeof Type;
}> = [
  {
    type: "rich_text",
    label: "Rich text",
    description: "Formatted instructions with lists and links",
    icon: Type,
  },
  {
    type: "image",
    label: "Image",
    description: "Screenshot or diagram",
    icon: ImageIcon,
  },
  {
    type: "video",
    label: "Video",
    description: "YouTube, Vimeo, or Loom embed",
    icon: Film,
  },
  {
    type: "external_link",
    label: "External link",
    description: "Deep link to Close, a doc, or any URL",
    icon: Link2,
  },
  {
    type: "callout",
    label: "Callout",
    description: "Info, tip, warning, or success highlight",
    icon: Info,
  },
  {
    type: "code_snippet",
    label: "Code snippet",
    description: "Commands, URLs, or config to copy",
    icon: Code2,
  },
];

/**
 * Factory for a new block of the given type. All new blocks start empty.
 */
export function createEmptyBlock(
  type: RoadmapContentBlockType,
  order: number,
): RoadmapContentBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "rich_text":
      return { id, order, type, data: { html: "" } };
    case "image":
      return {
        id,
        order,
        type,
        data: { url: "", storagePath: "", alt: "" },
      };
    case "video":
      return {
        id,
        order,
        type,
        data: { url: "", platform: "other" },
      };
    case "external_link":
      return { id, order, type, data: { url: "", label: "" } };
    case "callout":
      return {
        id,
        order,
        type,
        data: { variant: "info", body: "" },
      };
    case "code_snippet":
      return { id, order, type, data: { code: "" } };
  }
}

export function BlockTypePickerMenu({
  onPick,
  disabled,
}: BlockTypePickerMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add content block
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {BLOCK_OPTIONS.map(({ type, label, description, icon: Icon }) => (
          <DropdownMenuItem
            key={type}
            onClick={() => onPick(type)}
            className="gap-2 py-2 cursor-pointer"
          >
            <Icon className="h-4 w-4 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {label}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {description}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
