import { Badge } from "@/components/ui/badge";

export function ModuleStatusBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <Badge
      variant={isPublished ? "default" : "secondary"}
      className={`text-[10px] px-1.5 py-0 h-4 ${
        isPublished
          ? "bg-success/20 text-success dark:bg-success/30 dark:text-success"
          : "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle"
      }`}
    >
      {isPublished ? "Published" : "Draft"}
    </Badge>
  );
}
