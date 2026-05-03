import { Eye } from "lucide-react";

interface PromptPreviewPanelProps {
  prompt: string;
}

export function PromptPreviewPanel({ prompt }: PromptPreviewPanelProps) {
  if (!prompt.trim()) {
    return (
      <div className="rounded-lg border border-v2-ring bg-v2-canvas px-4 py-6 text-center dark:border-v2-ring dark:bg-v2-canvas/40">
        <Eye className="mx-auto h-5 w-5 text-v2-ink-subtle" />
        <p className="mt-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Fill in the sections above to see your agent's instructions here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-v2-ring dark:border-v2-ring">
      <div className="border-b border-v2-ring px-3 py-2 dark:border-v2-ring">
        <p className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink-muted">
          Live preview
        </p>
        <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          This is what your voice agent will use as its instructions.
        </p>
      </div>
      <pre className="max-h-[500px] overflow-y-auto overscroll-contain whitespace-pre-wrap px-3 py-3 text-[10px] leading-5 text-v2-ink dark:text-v2-ink-muted">
        {prompt}
      </pre>
    </div>
  );
}
