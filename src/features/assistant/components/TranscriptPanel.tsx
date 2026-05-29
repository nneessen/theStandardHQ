import { motion } from "framer-motion";
import { Loader2, Sparkles, User } from "lucide-react";
import { useTypewriter } from "../hooks/useTypewriter";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { toolMeta } from "../lib/toolMeta";
import { agentTheme } from "../lib/agentTheme";
import type { SoundCue } from "../hooks/useSound";
import type {
  ToolActivityItem,
  TranscriptMessage,
} from "../types/assistant.types";

const CHIP_STEP_MS = 260;

function chipColor(status: string, accent: string): string {
  if (status === "denied") return "#f59e0b";
  if (status === "error") return "#ef4444";
  return accent;
}

function ToolActivity({
  items,
  accent,
  animate,
  play,
}: {
  items?: ToolActivityItem[];
  accent: string;
  animate: boolean;
  play?: (cue: SoundCue) => void;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((t, i) => {
        const meta = toolMeta(t.name);
        const Icon = meta.icon;
        const color = chipColor(t.status, accent);
        return (
          <motion.span
            key={`${t.name}-${i}`}
            initial={animate ? { opacity: 0, y: 6, scale: 0.9 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: animate ? (i * CHIP_STEP_MS) / 1000 : 0 }}
            onAnimationComplete={() => animate && play?.("toolTick")}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: `${color}1a`, color }}
          >
            <Icon className="h-2.5 w-2.5" />
            {meta.label}
          </motion.span>
        );
      })}
    </div>
  );
}

function MessageRow({
  m,
  assistantName,
  accent,
  isLatest,
  play,
}: {
  m: TranscriptMessage;
  assistantName: string;
  accent: string;
  isLatest: boolean;
  play?: (cue: SoundCue) => void;
}) {
  const isUser = m.role === "user";
  const animate = isLatest && !isUser && !m.pending;
  const toolCount = m.toolActivity?.length ?? 0;
  const { shown, done } = useTypewriter(m.content, {
    enabled: animate,
    startDelayMs: toolCount * CHIP_STEP_MS + 150,
  });
  const theme = agentTheme(m.agentKey);
  const RowIcon = isUser ? User : theme.icon;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style={
          isUser ? undefined : { background: `${accent}22`, color: accent }
        }
      >
        {isUser ? (
          <span className="grid h-full w-full place-items-center rounded-full bg-muted text-foreground">
            <RowIcon className="h-4 w-4" />
          </span>
        ) : (
          <RowIcon className="h-4 w-4" />
        )}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {isUser ? "You" : assistantName}
        </div>
        {!isUser && (
          <ToolActivity
            items={m.toolActivity}
            accent={accent}
            animate={animate}
            play={play}
          />
        )}
        <div
          className={`mt-1 inline-block rounded-lg px-3 py-2 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "border bg-card/60 text-foreground backdrop-blur-sm"
          }`}
          style={isUser ? undefined : { borderColor: `${accent}26` }}
        >
          {m.pending ? (
            <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <ScanningText accent={accent} />
            </span>
          ) : isUser ? (
            <span className="whitespace-pre-wrap break-words">{m.content}</span>
          ) : animate && !done ? (
            // While the typewriter is still revealing, render plain text so we
            // never parse half-formed Markdown (e.g. an unclosed `**`); the
            // settled message below renders full Markdown.
            <span className="whitespace-pre-wrap break-words">
              {shown}
              <span
                className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse align-middle"
                style={{ background: accent }}
              />
            </span>
          ) : (
            <AssistantMarkdown content={m.content} />
          )}
        </div>
      </div>
    </div>
  );
}

function ScanningText({ accent }: { accent: string }) {
  return (
    <span>
      <span style={{ color: accent }}>▮</span> Scanning your data
      <span className="animate-pulse">…</span>
    </span>
  );
}

interface TranscriptPanelProps {
  messages: TranscriptMessage[];
  assistantName: string;
  accent: string;
  play?: (cue: SoundCue) => void;
}

export function TranscriptPanel({
  messages,
  assistantName,
  accent,
  play,
}: TranscriptPanelProps) {
  if (messages.length === 0) {
    return (
      <div className="grid h-full place-items-center py-16 text-center">
        <div className="max-w-sm space-y-3">
          <div
            className="mx-auto grid h-12 w-12 place-items-center rounded-full"
            style={{ background: `${accent}1a`, color: accent }}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="font-display text-base font-bold uppercase tracking-wide">
            Command center online
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

  const lastAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <MessageRow
          key={m.id}
          m={m}
          assistantName={assistantName}
          accent={accent}
          isLatest={m.id === lastAssistantId}
          play={play}
        />
      ))}
    </div>
  );
}
