import { Bot, Loader2, Sparkles, User, Wrench } from "lucide-react";
import type {
  ToolActivityItem,
  TranscriptMessage,
} from "../types/assistant.types";

function toolChipClass(status: string): string {
  if (status === "success") {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (status === "denied")
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-red-500/10 text-red-600 dark:text-red-400";
}

function ToolActivity({ items }: { items?: ToolActivityItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {items.map((t, i) => (
        <span
          key={`${t.name}-${i}`}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${toolChipClass(t.status)}`}
        >
          <Wrench className="h-2.5 w-2.5" />
          {t.name}
        </span>
      ))}
    </div>
  );
}

function MessageRow({
  m,
  assistantName,
}: {
  m: TranscriptMessage;
  assistantName: string;
}) {
  const isUser = m.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          isUser ? "bg-muted text-foreground" : "bg-primary/15 text-primary"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className="mb-0.5 text-[11px] font-medium text-muted-foreground">
          {isUser ? "You" : assistantName}
        </div>
        <div
          className={`inline-block rounded-lg px-3 py-2 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-foreground"
          }`}
        >
          {m.pending ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </span>
          ) : (
            <span className="whitespace-pre-wrap break-words">{m.content}</span>
          )}
        </div>
        {!isUser && <ToolActivity items={m.toolActivity} />}
      </div>
    </div>
  );
}

interface TranscriptPanelProps {
  messages: TranscriptMessage[];
  assistantName: string;
}

export function TranscriptPanel({
  messages,
  assistantName,
}: TranscriptPanelProps) {
  if (messages.length === 0) {
    return (
      <div className="grid h-full place-items-center py-16 text-center">
        <div className="max-w-sm space-y-3">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold">
            Your command center is ready
          </h3>
          <p className="text-sm text-muted-foreground">
            Ask {assistantName} to brief you on what needs your attention,
            surface policy risk, or draft an email or text for your review.
            Answers are grounded in your real data — never made up.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <MessageRow key={m.id} m={m} assistantName={assistantName} />
      ))}
    </div>
  );
}
