// src/features/messages/components/instagram/InstagramMessageInput.tsx
// Message composer with character limit for Instagram DMs

import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { Send, Loader2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { selectWindowStatus } from "@/lib/instagram";
import type {
  InstagramConversation,
  InstagramMessage,
} from "@/types/instagram.types";
import { InstagramTemplateSelector } from "./InstagramTemplateSelector";

const MAX_CHARS = 1000;

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
      <div className="flex items-center gap-2 p-2 bg-v2-ring rounded-lg border border-v2-ring">
        <AlertCircle className="h-4 w-4 text-v2-ink-subtle flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Messaging window closed
          </p>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-muted">
            You can only reply within 24 hours of their last message. Wait for
            them to message you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex items-end gap-2 p-1.5 bg-v2-canvas rounded-lg border transition-colors",
          isOverLimit ? "border-destructive/40" : "border-v2-ring",
        )}
      >
        <Textarea
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
          className={cn(
            "flex-1 min-h-[36px] max-h-[120px] resize-none border-0 bg-transparent p-1.5 text-[11px] placeholder:text-v2-ink-subtle",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
          )}
          rows={1}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Template selector */}
          <InstagramTemplateSelector
            onSelect={handleTemplateSelect}
            disabled={isDisabled}
            conversation={conversation}
            recentMessages={recentMessages}
          />

          {/* Schedule button */}
          {showScheduleButton && onScheduleClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onScheduleClick}
              disabled={isDisabled}
              title="Schedule message"
            >
              <Clock className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Send button */}
          <Button
            size="icon"
            className="h-7 w-7"
            onClick={handleSend}
            disabled={!canSend}
          >
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Character counter */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[9px] text-v2-ink-subtle">
          Press Enter to send, Shift+Enter for new line
        </p>
        <p
          className={cn(
            "text-[9px]",
            isOverLimit
              ? "text-destructive font-medium"
              : charCount > MAX_CHARS * 0.9
                ? "text-warning"
                : "text-v2-ink-subtle",
          )}
        >
          {charCount}/{MAX_CHARS}
        </p>
      </div>
    </div>
  );
}
