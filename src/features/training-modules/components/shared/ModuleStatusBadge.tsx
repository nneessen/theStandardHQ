import { Badge } from "@/components/ui/badge";
import { TINT } from "@/components/ui/StatusBadge";

export function ModuleStatusBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`text-[11px] px-1.5 py-0.5 ${isPublished ? TINT.emerald : TINT.slate}`}
    >
      {isPublished ? "Published" : "Draft"}
    </Badge>
  );
}
