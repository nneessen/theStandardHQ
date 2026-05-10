import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export type WorkflowState =
  | "uploaded"
  | "parsing"
  | "parsed"
  | "parse_failed"
  | "extracting"
  | "ready_for_review";

interface WorkflowProgressProps {
  state: WorkflowState;
  chunkIndex?: number;
  totalChunks?: number;
  setsCreated?: number;
  rulesCreated?: number;
}

export function WorkflowProgress({
  state,
  chunkIndex,
  totalChunks,
  setsCreated,
  rulesCreated,
}: WorkflowProgressProps) {
  if (state === "parsing") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Parsing
      </Badge>
    );
  }
  if (state === "parse_failed") {
    return <Badge variant="destructive">Parse failed</Badge>;
  }
  if (state === "extracting") {
    const progress =
      typeof chunkIndex === "number" && typeof totalChunks === "number"
        ? `${chunkIndex + 1}/${totalChunks}`
        : "…";
    const counts =
      typeof setsCreated === "number" && typeof rulesCreated === "number"
        ? ` · ${setsCreated} sets · ${rulesCreated} rules`
        : "";
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Extracting {progress}
        {counts}
      </Badge>
    );
  }
  if (state === "parsed") {
    return <Badge variant="outline">Parsed</Badge>;
  }
  if (state === "ready_for_review") {
    return <Badge variant="default">Ready for review</Badge>;
  }
  return <Badge variant="outline">Uploaded</Badge>;
}
