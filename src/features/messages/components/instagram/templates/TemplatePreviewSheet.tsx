// src/features/messages/components/instagram/templates/TemplatePreviewSheet.tsx
// Read-only Sheet for previewing the full body of an Instagram message template.

import { type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { Pencil } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useInstagramTemplateCategories } from "@/hooks";
import {
  MESSAGE_STAGE_LABELS,
  getCategoryLabel,
  type InstagramMessageTemplate,
  type MessageStage,
} from "@/types/instagram.types";
import { T } from "@/components/board/tokens";

interface TemplatePreviewSheetProps {
  template: InstagramMessageTemplate | null;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onEdit: (template: InstagramMessageTemplate) => void;
}

const STAGE_COLORS: Record<string, string> = {
  opener: T.violet,
  follow_up: T.blue,
  engagement: T.green,
  discovery: T.amber,
  closer: T.mut,
};

const formatRelative = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
};

/** Highlight {{variable}} tokens in template content */
function renderContentWithVars(content: string): ReactNode {
  const parts = content.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    if (/^{{[^}]+}}$/.test(part)) {
      return (
        <span
          key={i}
          style={{
            color: T.violet,
            fontWeight: 700,
            background: "rgba(182,155,255,0.12)",
            borderRadius: 4,
            padding: "0 3px",
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function TemplatePreviewSheet({
  template,
  onOpenChange,
  canEdit,
  onEdit,
}: TemplatePreviewSheetProps): ReactNode {
  const { data: customCategories = [] } = useInstagramTemplateCategories();
  const open = template !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[400px] sm:w-[540px] flex flex-col"
        style={{
          background: T.surface7,
          border: `1px solid ${T.line2}`,
          borderLeft: `1px solid ${T.line2}`,
          fontFamily: T.data,
          color: T.ink,
          padding: "24px 24px 20px",
        }}
      >
        {template && (
          <>
            <SheetHeader style={{ marginBottom: 0 }}>
              <SheetTitle
                style={{
                  font: `800 16px ${T.disp}`,
                  color: T.cream,
                  letterSpacing: "0.01em",
                }}
              >
                {template.name}
              </SheetTitle>
              <SheetDescription
                style={{
                  font: `500 12px/1.4 ${T.data}`,
                  color: T.mut2,
                  marginTop: 4,
                }}
              >
                Preview only. Click Edit to make changes.
              </SheetDescription>
            </SheetHeader>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 18,
                flex: 1,
                overflowY: "auto",
              }}
            >
              {/* Metadata chips row */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {template.message_stage && (
                  <span
                    style={{
                      height: 22,
                      padding: "0 9px",
                      borderRadius: 6,
                      background: "rgba(182,155,255,0.16)",
                      border: "1px solid rgba(182,155,255,0.30)",
                      color: STAGE_COLORS[template.message_stage] ?? T.violet,
                      font: `700 11px ${T.mono}`,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    {MESSAGE_STAGE_LABELS[
                      template.message_stage as MessageStage
                    ] || template.message_stage}
                  </span>
                )}
                {template.category && (
                  <span
                    style={{
                      height: 22,
                      padding: "0 9px",
                      borderRadius: 6,
                      background: "rgba(182,155,255,0.10)",
                      border: `1px solid ${T.line2}`,
                      color: T.mut,
                      font: `600 11px ${T.data}`,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    {getCategoryLabel(template.category, customCategories)}
                  </span>
                )}
                <span
                  style={{
                    marginLeft: "auto",
                    font: `600 11px ${T.data}`,
                    color: T.mut2,
                  }}
                >
                  Used {template.use_count || 0}× · Last used{" "}
                  {formatRelative(template.last_used_at)}
                </span>
              </div>

              {/* Full content */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    font: `700 10px ${T.mono}`,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: T.mut2,
                  }}
                >
                  Content
                </div>
                <pre
                  style={{
                    font: `500 13px/1.65 ${T.data}`,
                    color: T.ink,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    background: T.surface3,
                    border: `1px solid ${T.line}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                    margin: 0,
                  }}
                >
                  {renderContentWithVars(template.content)}
                </pre>
              </div>

              {/* Created */}
              <div
                style={{
                  font: `500 11px ${T.data}`,
                  color: T.mut2,
                }}
              >
                Created {formatRelative(template.created_at)}
              </div>
            </div>

            <SheetFooter
              style={{
                marginTop: 20,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                style={{
                  height: 34,
                  padding: "0 16px",
                  borderRadius: 8,
                  background: "transparent",
                  border: `1px solid ${T.line2}`,
                  color: T.mut,
                  font: `600 12px ${T.data}`,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(template)}
                  style={{
                    height: 34,
                    padding: "0 16px",
                    borderRadius: 8,
                    background: T.violet,
                    border: "none",
                    color: "#1a0f33",
                    font: `700 12px ${T.data}`,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Pencil style={{ width: 13, height: 13 }} />
                  Edit
                </button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
