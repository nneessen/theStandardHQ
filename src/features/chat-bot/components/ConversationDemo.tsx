// src/features/chat-bot/components/ConversationDemo.tsx
// SMS-style conversation demo with auto-typing animation

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Play, RotateCcw } from "lucide-react";
import {
  conversationScripts,
  type DemoMessage,
} from "../data/conversation-scripts";

// ─── Typing Indicator ───────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-0.5 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-v2-ink-subtle rounded-full animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

// ─── Chat Bubble ────────────────────────────────────────────────

function ChatBubble({
  message,
  isNew,
}: {
  message: DemoMessage;
  isNew: boolean;
}) {
  const isBot = message.sender === "bot";
  return (
    <div
      className={cn(
        "flex",
        isBot ? "justify-start" : "justify-end",
        isNew && "animate-in fade-in slide-in-from-bottom-2 duration-300",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] px-3 py-2 rounded-lg text-[11px] leading-relaxed",
          isBot
            ? "bg-v2-card-tinted dark:bg-v2-card-tinted text-v2-ink dark:text-v2-ink rounded-bl-sm"
            : "bg-info text-white rounded-br-sm",
        )}
      >
        {message.text}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function ConversationDemo() {
  const [activeScriptId, setActiveScriptId] = useState(
    conversationScripts[0].id,
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const activeScript =
    conversationScripts.find((s) => s.id === activeScriptId) ??
    conversationScripts[0];

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [visibleCount, isTyping, scrollToBottom]);

  const playConversation = useCallback(() => {
    const messages = activeScript.messages;
    setVisibleCount(0);
    setIsPlaying(true);
    setHasPlayed(true);
    setIsTyping(false);

    let index = 0;

    const showNext = () => {
      if (index >= messages.length) {
        setIsPlaying(false);
        return;
      }

      const msg = messages[index];
      const typingDuration = msg.sender === "bot" ? 1200 : 800;

      // Show typing indicator
      setIsTyping(true);

      timeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        setVisibleCount(index + 1);
        index++;

        // Schedule next message
        const nextMsg = messages[index];
        if (nextMsg) {
          timeoutRef.current = setTimeout(showNext, nextMsg.delay);
        } else {
          setIsPlaying(false);
        }
      }, typingDuration);
    };

    // Show first message immediately if delay is 0
    const firstDelay = messages[0]?.delay || 0;
    timeoutRef.current = setTimeout(showNext, firstDelay);
  }, [activeScript]);

  const handleScriptChange = (scriptId: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveScriptId(scriptId);
    setVisibleCount(0);
    setIsTyping(false);
    setIsPlaying(false);
    setHasPlayed(false);
  };

  const handleReplay = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    playConversation();
  };

  const visibleMessages = activeScript.messages.slice(0, visibleCount);
  const typingSide: "lead" | "bot" =
    visibleCount < activeScript.messages.length
      ? activeScript.messages[visibleCount].sender
      : "bot";

  return (
    <div className="rounded-lg border border-v2-ring dark:border-v2-ring overflow-hidden">
      {/* Scenario tabs */}
      <div className="flex border-b border-v2-ring dark:border-v2-ring bg-v2-canvas dark:bg-v2-card/50 overflow-x-auto">
        {conversationScripts.map((script) => (
          <button
            key={script.id}
            onClick={() => handleScriptChange(script.id)}
            className={cn(
              "px-3 py-2 text-[10px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
              activeScriptId === script.id
                ? "border-info text-info dark:border-info/70"
                : "border-transparent text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-ink-subtle",
            )}
          >
            {script.title}
          </button>
        ))}
      </div>

      {/* Phone mockup */}
      <div className="bg-v2-card p-3">
        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-v2-canvas dark:bg-v2-card-tinted/50 rounded-t-lg border border-b-0 border-v2-ring dark:border-v2-ring-strong">
          <span className="text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted">
            Messages
          </span>
          <span className="text-[9px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
            {activeScript.description}
          </span>
        </div>

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className="h-[260px] overflow-y-auto border border-v2-ring dark:border-v2-ring-strong rounded-b-lg bg-white dark:bg-v2-canvas px-3 py-3 space-y-2"
        >
          {!hasPlayed && !isPlaying ? (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <button
                onClick={playConversation}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-info hover:bg-info text-white text-[11px] font-medium transition-colors"
              >
                <Play className="h-3 w-3" />
                Watch Demo
              </button>
              <p className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted">
                See how the bot handles this conversation
              </p>
            </div>
          ) : (
            <>
              {visibleMessages.map((msg, i) => (
                <ChatBubble
                  key={`${activeScriptId}-${i}`}
                  message={msg}
                  isNew={i === visibleCount - 1}
                />
              ))}

              {isTyping && (
                <div
                  className={cn(
                    "flex",
                    typingSide === "bot" ? "justify-start" : "justify-end",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-lg",
                      typingSide === "bot"
                        ? "bg-v2-card-tinted dark:bg-v2-card-tinted rounded-bl-sm"
                        : "bg-info/80 rounded-br-sm",
                    )}
                  >
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div />
            </>
          )}
        </div>

        {/* Replay button */}
        {hasPlayed &&
          !isPlaying &&
          visibleCount >= activeScript.messages.length && (
            <div className="flex justify-center mt-2">
              <button
                onClick={handleReplay}
                className="flex items-center gap-1 text-[10px] text-v2-ink-subtle hover:text-v2-ink-muted dark:hover:text-v2-ink-subtle transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Replay
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
