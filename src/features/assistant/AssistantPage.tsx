import { useRef, useState } from "react";
import { toast } from "sonner";
import { useSendAssistantMessage } from "./hooks/useAssistant";
import { useAssistantPreferences } from "./hooks/useAssistantPreferences";
import { CommandCenterLayout } from "./components/CommandCenterLayout";
import { CommandInput } from "./components/CommandInput";
import { PendingActionsPanel } from "./components/PendingActionsPanel";
import { TranscriptPanel } from "./components/TranscriptPanel";
import {
  DEFAULT_ASSISTANT_NAME,
  type TranscriptMessage,
} from "./types/assistant.types";

export function AssistantPage() {
  const { data: prefs } = useAssistantPreferences();
  const assistantName = prefs?.assistant_name ?? DEFAULT_ASSISTANT_NAME;
  const send = useSendAssistantMessage();

  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentKey, setAgentKey] = useState<string | null>(null);
  const [focusActionId, setFocusActionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const handleSend = (text: string) => {
    if (send.isPending) return;
    const userMsg: TranscriptMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const placeholderId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      userMsg,
      { id: placeholderId, role: "assistant", content: "", pending: true },
    ]);
    scrollToBottom();

    send.mutate(
      { message: text, conversationId },
      {
        onSuccess: (res) => {
          setConversationId(res.conversationId);
          setAgentKey(res.agentKey);
          setMessages((m) =>
            m.map((msg) =>
              msg.id === placeholderId
                ? {
                    id: placeholderId,
                    role: "assistant",
                    content: res.message,
                    toolActivity: res.toolActivity,
                    agentKey: res.agentKey,
                  }
                : msg,
            ),
          );
          if (res.actionRequests?.length) {
            setFocusActionId(res.actionRequests[0].actionRequestId);
            toast.message("A draft is ready for your approval.");
          }
          scrollToBottom();
        },
        onError: (e) => {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === placeholderId
                ? {
                    id: placeholderId,
                    role: "assistant",
                    content:
                      "Sorry — I couldn't complete that. Please try again.",
                  }
                : msg,
            ),
          );
          toast.error(
            e instanceof Error ? e.message : "The assistant failed to respond.",
          );
          scrollToBottom();
        },
      },
    );
  };

  return (
    <CommandCenterLayout assistantName={assistantName} agentKey={agentKey}>
      <div className="space-y-3">
        <div
          ref={scrollRef}
          className="h-[60vh] overflow-y-auto rounded-xl border border-border bg-card p-4"
        >
          <TranscriptPanel messages={messages} assistantName={assistantName} />
        </div>
        <PendingActionsPanel focusActionId={focusActionId} />
        <CommandInput
          onSend={handleSend}
          disabled={send.isPending}
          assistantName={assistantName}
        />
      </div>
    </CommandCenterLayout>
  );
}
