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
    <div className="my-2 rounded-lg border border-border overflow-hidden shadow-sm bg-[#0d1117]">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-300 bg-[#161b22] border-b border-zinc-800">
          <span>{label}</span>
          <span className="text-[9px] text-zinc-500 font-normal normal-case tracking-normal">
            Click to copy
          </span>
        </div>
      )}
      <div className="relative group">
        <pre className="overflow-x-auto p-4 text-sm text-zinc-100 font-mono leading-relaxed">
          <code>{code}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-md bg-zinc-800 text-zinc-400 opacity-0 shadow-sm transition-all hover:bg-zinc-700 hover:text-zinc-100 group-hover:opacity-100 active:scale-95"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
