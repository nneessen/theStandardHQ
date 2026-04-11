// src/features/agent-roadmap/components/blocks/CodeSnippetBlockView.tsx
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { CodeSnippetBlock } from "../../types/contentBlocks";

interface CodeSnippetBlockViewProps {
  block: CodeSnippetBlock;
}

export function CodeSnippetBlockView({ block }: CodeSnippetBlockViewProps) {
  const { code, label } = block.data;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div className="my-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-950 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-zinc-400 bg-zinc-900 border-b border-zinc-800">
          <span>{label}</span>
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto p-3 text-xs text-zinc-100 font-mono leading-relaxed">
          <code>{code}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
}
