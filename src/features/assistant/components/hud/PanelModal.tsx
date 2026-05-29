import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  accent: string;
  children: ReactNode;
}

/**
 * Reusable expanded-detail modal for the command-center HUD panels. Styled as dark
 * glass to match the reactor stage; a panel opens this with its own detail view.
 */
export function PanelModal({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  accent,
  children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl gap-0 border bg-[#070b16]/95 p-0 text-foreground backdrop-blur-xl"
        style={{
          borderColor: `${accent}33`,
          boxShadow: `0 0 60px ${accent}22`,
        }}
      >
        <DialogHeader
          className="space-y-0 border-b px-4 py-3 text-left"
          style={{ borderColor: `${accent}1f` }}
        >
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em]">
            {Icon && <Icon className="h-4 w-4" style={{ color: accent }} />}
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {description ?? `${title} detail`}
          </DialogDescription>
        </DialogHeader>
        <div className="p-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
