import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { FontPicker } from "./FontPicker";
import { EmailFontWeight } from "@/types/email.types";
import type { EmailBlock, EmailBlockStyles } from "@/types/email.types";

interface BlockStylePanelProps {
  block: EmailBlock | null;
  onChange: (block: EmailBlock) => void;
}

/** Compact eyebrow label used throughout the panel */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-mono text-[10px] font-bold uppercase tracking-widest"
      style={{ color: "var(--mut2)" }}
    >
      {children}
    </p>
  );
}

export function BlockStylePanel({ block, onChange }: BlockStylePanelProps) {
  if (!block) {
    return (
      <div
        className="flex h-full w-[168px] shrink-0 flex-col"
        style={{
          background: "var(--surface-2)",
          borderLeft: "1px solid var(--line)",
        }}
      >
        <div
          className="px-2.5 py-2"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <p
            className="font-display text-[13px] font-extrabold uppercase tracking-wide"
            style={{ color: "var(--ink)" }}
          >
            Styles
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center p-2">
          <p
            className="text-center font-sans text-[11px]"
            style={{ color: "var(--mut2)" }}
          >
            Select a block to edit
          </p>
        </div>
      </div>
    );
  }

  const updateStyles = (updates: Partial<EmailBlockStyles>) => {
    onChange({
      ...block,
      styles: { ...block.styles, ...updates },
    });
  };

  const hasTextContent = ["header", "text", "footer", "quote"].includes(
    block.type,
  );
  const hasAlignment = [
    "header",
    "text",
    "button",
    "footer",
    "image",
    "social",
  ].includes(block.type);

  return (
    <div
      className="flex h-full w-[168px] shrink-0 flex-col"
      style={{
        background: "var(--surface-2)",
        borderLeft: "1px solid var(--line)",
      }}
    >
      {/* Panel header */}
      <div
        className="px-2.5 py-2"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <p
          className="font-display text-[13px] font-extrabold uppercase tracking-wide"
          style={{ color: "var(--ink)" }}
        >
          {block.type.charAt(0).toUpperCase() + block.type.slice(1)} Styles
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-2.5">
        {/* Background Color */}
        <div className="space-y-1">
          <FieldLabel>Background</FieldLabel>
          <div className="flex gap-1">
            <Input
              type="color"
              value={block.styles.backgroundColor || "#ffffff"}
              onChange={(e) =>
                updateStyles({ backgroundColor: e.target.value })
              }
              className="h-6 w-8 p-0.5"
            />
            <Input
              value={block.styles.backgroundColor || ""}
              onChange={(e) =>
                updateStyles({ backgroundColor: e.target.value })
              }
              placeholder="transparent"
              className="h-6 flex-1 font-mono text-[10px]"
            />
          </div>
        </div>

        {/* Text Color (for text-containing blocks) */}
        {hasTextContent && (
          <div className="space-y-1">
            <FieldLabel>Text Color</FieldLabel>
            <div className="flex gap-1">
              <Input
                type="color"
                value={block.styles.textColor || "#374151"}
                onChange={(e) => updateStyles({ textColor: e.target.value })}
                className="h-6 w-8 p-0.5"
              />
              <Input
                value={block.styles.textColor || ""}
                onChange={(e) => updateStyles({ textColor: e.target.value })}
                placeholder="#374151"
                className="h-6 flex-1 font-mono text-[10px]"
              />
            </div>
          </div>
        )}

        {/* Font Family with Visual Preview */}
        {hasTextContent && (
          <div className="space-y-1">
            <FieldLabel>Font</FieldLabel>
            <FontPicker
              value={block.styles.fontFamily}
              onChange={(font) => updateStyles({ fontFamily: font })}
              weight={
                block.styles.fontWeight
                  ? (parseInt(block.styles.fontWeight) as EmailFontWeight)
                  : undefined
              }
              onWeightChange={(weight) =>
                updateStyles({ fontWeight: String(weight) })
              }
            />
          </div>
        )}

        {/* Line Height */}
        {hasTextContent && (
          <div className="space-y-1">
            <FieldLabel>Line Height</FieldLabel>
            <Select
              value={block.styles.lineHeight || "1.5"}
              onValueChange={(value) => updateStyles({ lineHeight: value })}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Tight (1)</SelectItem>
                <SelectItem value="1.25">Snug (1.25)</SelectItem>
                <SelectItem value="1.5">Normal (1.5)</SelectItem>
                <SelectItem value="1.75">Relaxed (1.75)</SelectItem>
                <SelectItem value="2">Loose (2)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Alignment */}
        {hasAlignment && (
          <div className="space-y-1">
            <FieldLabel>Alignment</FieldLabel>
            <Select
              value={block.styles.alignment || "left"}
              onValueChange={(value) =>
                updateStyles({
                  alignment: value as "left" | "center" | "right",
                })
              }
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Padding */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <FieldLabel>Padding</FieldLabel>
            <span
              className="font-mono text-[9px]"
              style={{ color: "var(--mut2)" }}
            >
              {parseInt(block.styles.padding || "16") || 16}px
            </span>
          </div>
          <Slider
            value={[parseInt(block.styles.padding || "16") || 16]}
            onValueChange={([value]) => updateStyles({ padding: `${value}px` })}
            min={0}
            max={48}
            step={4}
          />
        </div>

        {/* Font Size (for header) */}
        {block.type === "header" && (
          <div className="space-y-1">
            <FieldLabel>Font Size</FieldLabel>
            <Select
              value={block.styles.fontSize || "20px"}
              onValueChange={(value) => updateStyles({ fontSize: value })}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16px">Small</SelectItem>
                <SelectItem value="20px">Medium</SelectItem>
                <SelectItem value="24px">Large</SelectItem>
                <SelectItem value="32px">X-Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Border Radius */}
        {["button", "image", "quote"].includes(block.type) && (
          <div className="space-y-1">
            <FieldLabel>Corner Radius</FieldLabel>
            <Select
              value={block.styles.borderRadius || "6px"}
              onValueChange={(value) => updateStyles({ borderRadius: value })}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0px">None</SelectItem>
                <SelectItem value="4px">Small</SelectItem>
                <SelectItem value="6px">Medium</SelectItem>
                <SelectItem value="12px">Large</SelectItem>
                <SelectItem value="9999px">Pill</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Border Controls */}
        <div
          className="space-y-1.5 pt-2"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <FieldLabel>Border</FieldLabel>
          <div className="space-y-1">
            <Select
              value={block.styles.borderStyle || "none"}
              onValueChange={(value) =>
                updateStyles({
                  borderStyle: value as "none" | "solid" | "dashed" | "dotted",
                })
              }
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
              </SelectContent>
            </Select>
            {block.styles.borderStyle &&
              block.styles.borderStyle !== "none" && (
                <div className="flex gap-1">
                  <Input
                    type="color"
                    value={block.styles.borderColor || "#e5e7eb"}
                    onChange={(e) =>
                      updateStyles({ borderColor: e.target.value })
                    }
                    className="h-6 w-8 p-0.5"
                  />
                  <Select
                    value={block.styles.borderWidth || "1px"}
                    onValueChange={(value) =>
                      updateStyles({ borderWidth: value })
                    }
                  >
                    <SelectTrigger className="h-6 flex-1 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1px">1px</SelectItem>
                      <SelectItem value="2px">2px</SelectItem>
                      <SelectItem value="3px">3px</SelectItem>
                      <SelectItem value="4px">4px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
          </div>
        </div>

        {/* Image width */}
        {block.type === "image" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <FieldLabel>Width</FieldLabel>
              <span
                className="font-mono text-[9px]"
                style={{ color: "var(--mut2)" }}
              >
                {block.styles.width || "100%"}
              </span>
            </div>
            <Select
              value={block.styles.width || "100%"}
              onValueChange={(value) => updateStyles({ width: value })}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25%">25%</SelectItem>
                <SelectItem value="50%">50%</SelectItem>
                <SelectItem value="75%">75%</SelectItem>
                <SelectItem value="100%">100%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
