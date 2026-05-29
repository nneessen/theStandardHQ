import { useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_ACCENT } from "../lib/agentTheme";

const QUICK_PROMPTS = [
  "Brief me on what needs my attention today",
  "What policies are at risk?",
  "How is my team's production?",
];

interface CommandInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  assistantName?: string;
  accent?: string;
}

export function CommandInput({
  onSend,
  disabled,
  assistantName = "Jarvis",
  accent = DEFAULT_ACCENT,
}: CommandInputProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

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
      <div
        className="flex items-end gap-2 rounded-xl border bg-card/50 p-2 backdrop-blur-md transition-shadow"
        style={{
          borderColor: focused ? `${accent}88` : `${accent}33`,
          boxShadow: focused ? `0 0 24px ${accent}33` : "none",
        }}
      >
        <ChevronRight
          className="mb-2.5 ml-1 h-4 w-4 shrink-0"
          style={{ color: accent }}
        />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={`Ask ${assistantName}…  (Enter to send, Shift+Enter for a new line)`}
          rows={2}
          disabled={disabled}
          className="resize-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0"
        />
        <Button
          onClick={submit}
          disabled={disabled || !text.trim()}
          size="icon"
          className="h-10 w-10 shrink-0"
          aria-label="Send"
          style={{ background: accent, color: "#050811" }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((p, i) => (
          <motion.button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onSend(p)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ scale: 1.03 }}
            className="inline-flex items-center gap-1 rounded-full border bg-card/40 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground disabled:opacity-50"
            style={{ borderColor: `${accent}33` }}
          >
            <Sparkles className="h-3 w-3" style={{ color: accent }} />
            {p}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
