// src/features/messages/components/instagram/templates/TemplateDeleteDialog.tsx
// Confirmation dialog for deleting Instagram message templates

import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteInstagramTemplate } from "@/hooks";
import type { InstagramMessageTemplate } from "@/types/instagram.types";
import { T } from "@/components/board/tokens";

interface TemplateDeleteDialogProps {
  template: InstagramMessageTemplate | null;
  onClose: () => void;
}

export function TemplateDeleteDialog({
  template,
  onClose,
}: TemplateDeleteDialogProps): ReactNode {
  const deleteMutation = useDeleteInstagramTemplate();

  const handleDelete = async () => {
    if (!template) return;

    try {
      await deleteMutation.mutateAsync(template.id);
      toast.success("Template deleted");
      onClose();
    } catch (_error) {
      toast.error("Failed to delete template");
    }
  };

  return (
    <AlertDialog open={!!template} onOpenChange={() => onClose()}>
      <AlertDialogContent
        style={{
          background: T.surface7,
          border: `1px solid ${T.line2}`,
          borderRadius: 14,
          fontFamily: T.data,
          color: T.ink,
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            style={{
              font: `800 15px ${T.disp}`,
              color: T.cream,
            }}
          >
            Delete Template
          </AlertDialogTitle>
          <AlertDialogDescription
            style={{
              font: `500 13px/1.5 ${T.data}`,
              color: T.mut,
            }}
          >
            Are you sure you want to delete &quot;{template?.name}&quot;? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onClose}
            disabled={deleteMutation.isPending}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 8,
              background: "transparent",
              border: `1px solid ${T.line2}`,
              color: T.mut,
              font: `600 12px ${T.data}`,
              cursor: "pointer",
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 8,
              background: T.red,
              border: "none",
              color: "#fff",
              font: `700 12px ${T.data}`,
              cursor: deleteMutation.isPending ? "not-allowed" : "pointer",
              opacity: deleteMutation.isPending ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {deleteMutation.isPending && (
              <Loader2
                style={{
                  width: 13,
                  height: 13,
                  animation: "spin 1s linear infinite",
                }}
              />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
