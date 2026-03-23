import { Eye } from "lucide-react";

interface PromptPreviewPanelProps {
  prompt: string;
}

export function PromptPreviewPanel({ prompt }: PromptPreviewPanelProps) {
  if (!prompt.trim()) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
        <Eye className="mx-auto h-5 w-5 text-zinc-400" />
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          Fill in the sections above to see your agent's instructions here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
          Live preview
        </p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          This is what your voice agent will use as its instructions.
        </p>
      </div>
      <pre className="max-h-[500px] overflow-y-auto overscroll-contain whitespace-pre-wrap px-3 py-3 text-[10px] leading-5 text-zinc-700 dark:text-zinc-300">
        {prompt}
      </pre>
    </div>
  );
}
