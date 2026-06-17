import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Type,
  MousePointerClick,
  Minus,
  ArrowDownUp,
  FileText,
  Heading,
  Plus,
  Image,
  Quote,
  Share2,
  Columns2,
} from "lucide-react";
import type { EmailBlockType } from "@/types/email.types";

interface BlockPaletteProps {
  onAddBlock: (type: EmailBlockType) => void;
  disabled?: boolean;
}

interface DraggableBlockProps {
  type: EmailBlockType;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onAdd: () => void;
}

function DraggableBlock({
  type,
  label,
  icon,
  disabled,
  onAdd,
}: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette-${type}`,
      data: { type, isFromPalette: true },
      disabled,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isDragging ? "var(--surface-4)" : "var(--surface-3)",
        border: "1px solid var(--line)",
        opacity: isDragging || disabled ? 0.5 : 1,
      }}
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-4)]"
    >
      {/* Draggable area */}
      <div
        {...listeners}
        {...attributes}
        className={
          "flex flex-1 cursor-grab items-center gap-2 active:cursor-grabbing" +
          (disabled ? " cursor-not-allowed" : "")
        }
      >
        <span style={{ color: "var(--mut)" }}>{icon}</span>
        <span
          className="font-sans text-[13px] font-semibold"
          style={{ color: "var(--ink)" }}
        >
          {label}
        </span>
      </div>
      {/* Click to add button */}
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-5,var(--surface-4))]"
        style={{ color: "var(--mut2)" }}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        disabled={disabled}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

const BLOCK_DEFINITIONS: {
  type: EmailBlockType;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "header",
    label: "Header",
    icon: <Heading className="h-3.5 w-3.5" />,
  },
  { type: "text", label: "Text", icon: <Type className="h-3.5 w-3.5" /> },
  { type: "image", label: "Image", icon: <Image className="h-3.5 w-3.5" /> },
  {
    type: "button",
    label: "Button",
    icon: <MousePointerClick className="h-3.5 w-3.5" />,
  },
  {
    type: "columns",
    label: "Columns",
    icon: <Columns2 className="h-3.5 w-3.5" />,
  },
  { type: "quote", label: "Quote", icon: <Quote className="h-3.5 w-3.5" /> },
  {
    type: "social",
    label: "Social",
    icon: <Share2 className="h-3.5 w-3.5" />,
  },
  {
    type: "divider",
    label: "Divider",
    icon: <Minus className="h-3.5 w-3.5" />,
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: <ArrowDownUp className="h-3.5 w-3.5" />,
  },
  {
    type: "footer",
    label: "Footer",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
];

export function BlockPalette({ onAddBlock, disabled }: BlockPaletteProps) {
  return (
    <div
      className="flex w-[152px] shrink-0 flex-col"
      style={{
        background: "var(--surface-2)",
        borderRight: "1px solid var(--line)",
      }}
    >
      {/* Header */}
      <div
        className="px-2.5 py-2"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <p
          className="font-mono text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--mut2)" }}
        >
          Blocks
        </p>
      </div>

      {/* Block chips */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {BLOCK_DEFINITIONS.map((block) => (
          <DraggableBlock
            key={block.type}
            type={block.type}
            label={block.label}
            icon={block.icon}
            disabled={disabled}
            onAdd={() => onAddBlock(block.type)}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div
        className="px-2.5 py-1.5"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <p
          className="font-mono text-[9px] uppercase tracking-widest"
          style={{ color: "var(--mut2)" }}
        >
          Drag or click +
        </p>
      </div>
    </div>
  );
}
