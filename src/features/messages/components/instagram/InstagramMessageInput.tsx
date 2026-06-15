// src/features/messages/components/instagram/InstagramMessageInput.tsx
// Message composer with character limit for Instagram DMs — board token restyle

import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { Send, Loader2, AlertCircle, Clock } from "lucide-react";
import { T } from "@/components/board/tokens";
import { selectWindowStatus } from "@/lib/instagram";
import type {
  InstagramConversation,
  InstagramMessage,
} from "@/types/instagram.types";
import { InstagramTemplateSelector } from "./InstagramTemplateSelector";

const MAX_CHARS = 1000;

// Violet — solid for Send button bg, dark text for contrast
const VIOLET_SEND_TEXT = "#1a0f33";

interface InstagramMessageInputProps {
  canReplyUntil: string | null;
  onSend: (text: string, templateId?: string) => void;
  onScheduleClick?: () => void;
  isSending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showScheduleButton?: boolean;
  /** Conversation context for template selector */
  conversation?: InstagramConversation | null;
  /** Recent messages for template selector context */
  recentMessages?: InstagramMessage[];
}

export function InstagramMessageInput({
  canReplyUntil,
  onSend,
  onScheduleClick,
  isSending = false,
  disabled = false,
  placeholder = "Type a message...",
  showScheduleButton = true,
  conversation,
  recentMessages,
}: InstagramMessageInputProps): ReactNode {
  const [text, setText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const windowStatus = selectWindowStatus(canReplyUntil);
  const isWindowClosed = windowStatus === "closed";
  const isDisabled = disabled || isSending || isWindowClosed;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSend = text.trim().length > 0 && !isOverLimit && !isDisabled;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim(), selectedTemplateId || undefined);
    setText("");
    setSelectedTemplateId(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleTemplateSelect = (content: string, templateId: string) => {
    setText(content);
    setSelectedTemplateId(templateId);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Window closed state
  if (isWindowClosed) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: T.surface3,
          borderRadius: 11,
          border: `1px solid ${T.line}`,
        }}
      >
        <AlertCircle
          style={{ width: 16, height: 16, color: T.red, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              font: `600 12px ${T.data}`,
              color: T.mut,
              margin: "0 0 2px",
            }}
          >
            Messaging window closed
          </p>
          <p style={{ font: `500 11px ${T.data}`, color: T.mut2, margin: 0 }}>
            You can only reply within 24 hours of their last message. Wait for
            them to message you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Composer shell */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          padding: "8px 10px 8px 14px",
          background: T.surface3,
          borderRadius: 11,
          border: `1px solid ${isOverLimit ? "rgba(255,106,93,0.40)" : T.line2}`,
          transition: "border-color .12s",
        }}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Clear template ID if user modifies text
            if (selectedTemplateId) {
              setSelectedTemplateId(null);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          style={{
            flex: 1,
            minHeight: 36,
            maxHeight: 120,
            resize: "none",
            border: "none",
            background: "transparent",
            padding: "0",
            font: `500 13px ${T.data}`,
            color: T.ink,
            outline: "none",
            lineHeight: 1.5,
            opacity: isDisabled ? 0.5 : 1,
          }}
          // Inline ::placeholder doesn't work in style= but we set the color
          // via a class fallback for the subtle placeholder
          className="placeholder:text-[rgba(255,255,255,0.42)]"
        />

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          {/* Template selector */}
          <InstagramTemplateSelector
            onSelect={handleTemplateSelect}
            disabled={isDisabled}
            conversation={conversation}
            recentMessages={recentMessages}
          />

          {/* Schedule button */}
          {showScheduleButton && onScheduleClick && (
            <button
              type="button"
              onClick={onScheduleClick}
              disabled={isDisabled}
              title="Schedule message"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "transparent",
                border: `1px solid ${T.line2}`,
                color: isDisabled ? T.mut2 : T.mut,
                cursor: isDisabled ? "not-allowed" : "pointer",
                transition: "color .12s, border-color .12s",
              }}
              onMouseEnter={(e) => {
                if (!isDisabled) {
                  (e.currentTarget as HTMLButtonElement).style.color = T.ink;
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    T.line2;
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = isDisabled
                  ? T.mut2
                  : T.mut;
              }}
            >
              <Clock style={{ width: 13, height: 13 }} />
            </button>
          )}

          {/* Send button — solid violet */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: 32,
              padding: "0 14px",
              borderRadius: 9,
              background: canSend ? T.violet : "rgba(182,155,255,0.18)",
              border: "none",
              color: canSend ? VIOLET_SEND_TEXT : "rgba(182,155,255,0.40)",
              font: `700 12.5px ${T.data}`,
              cursor: canSend ? "pointer" : "not-allowed",
              transition: "background .12s, color .12s",
              flexShrink: 0,
            }}
          >
            {isSending ? (
              <Loader2
                style={{ width: 13, height: 13 }}
                className="animate-spin"
              />
            ) : (
              <Send style={{ width: 13, height: 13 }} />
            )}
            <span>Send</span>
          </button>
        </div>
      </div>

      {/* Character counter + hint */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 4px",
        }}
      >
        <p
          style={{
            font: `500 10px ${T.data}`,
            color: "rgba(255,255,255,0.28)",
            margin: 0,
          }}
        >
          Enter to send · Shift+Enter for new line
        </p>
        <p
          style={{
            font: `600 10px ${T.mono}`,
            color: isOverLimit
              ? T.red
              : charCount > MAX_CHARS * 0.9
                ? T.amber
                : "rgba(255,255,255,0.28)",
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          {charCount}/{MAX_CHARS}
        </p>
      </div>
    </div>
  );
}
