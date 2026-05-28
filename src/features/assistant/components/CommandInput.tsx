import { useState, type KeyboardEvent } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const QUICK_PROMPTS = [
  "Brief me on what needs my attention today",
  "What policies are at risk?",
  "How is my team's production?",
];

interface CommandInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  assistantName?: string;
}

export function CommandInput({
  onSend,
  disabled,
  assistantName = "Jarvis",
}: CommandInputProps) {
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Ask ${assistantName}…  (Enter to send, Shift+Enter for a new line)`}
          rows={2}
          disabled={disabled}
          className="resize-none"
        />
        <Button
          onClick={submit}
          disabled={disabled || !text.trim()}
          size="icon"
          className="h-10 w-10 shrink-0"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onSend(p)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" />
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
