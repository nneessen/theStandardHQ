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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[13px]">
            Delete Template
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[11px]">
            Are you sure you want to delete &quot;{template?.name}&quot;? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onClose}
            disabled={deleteMutation.isPending}
            className="h-8 text-[11px]"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="h-8 text-[11px] bg-destructive hover:bg-destructive focus:ring-destructive"
          >
            {deleteMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
