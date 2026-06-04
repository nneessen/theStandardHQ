import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useDeleteJarvisMemory,
  useJarvisMemory,
} from "../hooks/useJarvisMemory";

/**
 * Lists the user's durable Jarvis memories with a delete control. This is the home
 * for viewing/forgetting memory; new memories are saved conversationally (the
 * saveMemory tool), so there is no add form here.
 */
export function MemoryPanel() {
  const { data: memories, isLoading } = useJarvisMemory();
  const del = useDeleteJarvisMemory();

  const remove = async (id: string) => {
    try {
      await del.mutateAsync(id);
    } catch {
      toast.error("Couldn't delete that memory.");
    }
  };

  return (
    <div className="ml-4 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Saved memories
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : !memories || memories.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Nothing saved yet. Ask Jarvis to remember a fact, goal, or preference
          (e.g. "remember my goal is $50k AP this quarter").
        </div>
      ) : (
        <ul className="space-y-1.5">
          {memories.map((m) => (
            <li
              key={m.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border p-2"
            >
              <div className="min-w-0">
                <span className="mr-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {m.kind}
                </span>
                <span className="text-xs">{m.content}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(m.id)}
                disabled={del.isPending}
                aria-label="Delete memory"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
