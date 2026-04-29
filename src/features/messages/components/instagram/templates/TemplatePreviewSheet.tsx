// src/features/messages/components/instagram/templates/TemplatePreviewSheet.tsx
// Read-only Sheet for previewing the full body of an Instagram message template.

import { type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useInstagramTemplateCategories } from "@/hooks";
import {
  MESSAGE_STAGE_LABELS,
  getCategoryLabel,
  type InstagramMessageTemplate,
  type MessageStage,
} from "@/types/instagram.types";

interface TemplatePreviewSheetProps {
  template: InstagramMessageTemplate | null;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onEdit: (template: InstagramMessageTemplate) => void;
}

const getStageBadgeVariant = (
  stage: string | null,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (stage) {
    case "opener":
      return "default";
    case "follow_up":
    case "engagement":
      return "secondary";
    case "discovery":
      return "destructive";
    case "closer":
      return "outline";
    default:
      return "secondary";
  }
};

const formatRelative = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
};

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
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        {template && (
          <>
            <SheetHeader>
              <SheetTitle className="text-[13px]">{template.name}</SheetTitle>
              <SheetDescription className="text-[11px]">
                Preview only. Click Edit to make changes.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4 flex-1 overflow-auto">
              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-1.5">
                {template.message_stage && (
                  <Badge
                    variant={getStageBadgeVariant(template.message_stage)}
                    className="text-[10px] h-5"
                  >
                    {MESSAGE_STAGE_LABELS[
                      template.message_stage as MessageStage
                    ] || template.message_stage}
                  </Badge>
                )}
                {template.category && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {getCategoryLabel(template.category, customCategories)}
                  </Badge>
                )}
                <span className="text-[10px] text-v2-ink-subtle ml-auto">
                  Used {template.use_count || 0}× · Last used{" "}
                  {formatRelative(template.last_used_at)}
                </span>
              </div>

              {/* Full content */}
              <div>
                <div className="text-[11px] font-medium text-v2-ink-muted mb-1.5">
                  Content
                </div>
                <pre className="text-[11px] text-v2-ink-muted whitespace-pre-wrap break-words bg-v2-canvas border border-v2-ring rounded-v2-sm p-3 font-sans leading-relaxed">
                  {template.content}
                </pre>
              </div>

              {/* Created */}
              <div className="text-[10px] text-v2-ink-subtle">
                Created {formatRelative(template.created_at)}
              </div>
            </div>

            <SheetFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-8 text-[11px]"
              >
                Close
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  onClick={() => onEdit(template)}
                  className="h-8 text-[11px]"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
