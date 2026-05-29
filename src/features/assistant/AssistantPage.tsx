import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useSendAssistantMessage } from "./hooks/useAssistant";
import { useAssistantPreferences } from "./hooks/useAssistantPreferences";
import { useAssistantVoiceSession } from "./hooks/useAssistantVoiceSession";
import { useSound } from "./hooks/useSound";
import { CommandCenterLayout } from "./components/CommandCenterLayout";
import { CommandInput } from "./components/CommandInput";
import { PendingActionsPanel } from "./components/PendingActionsPanel";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { VoiceImmersion } from "./components/VoiceImmersion";
import { BootSequence } from "./components/hud/BootSequence";
import type { ReactorMode } from "./components/hud/ArcReactor";
import { agentTheme } from "./lib/agentTheme";
import {
  DEFAULT_ASSISTANT_NAME,
  type TranscriptMessage,
} from "./types/assistant.types";

const VOICE_ACTIVE = new Set([
  "listening",
  "capturing",
  "thinking",
  "checking",
  "speaking",
]);

export function AssistantPage() {
  const { data: prefs } = useAssistantPreferences();
  const assistantName = prefs?.assistant_name ?? DEFAULT_ASSISTANT_NAME;
  const { play } = useSound(prefs?.sound_enabled ?? true);
  const send = useSendAssistantMessage();
  const prefersReduced = useReducedMotion();

  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentKey, setAgentKey] = useState<string | null>(null);
  const [focusActionId, setFocusActionId] = useState<string | null>(null);
  const [justResponded, setJustResponded] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  const accent = agentTheme(agentKey).accent;

  // --- Boot sequence: once per session, never under reduced motion ---------------
  const [booting, setBooting] = useState(
    () =>
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("jarvis-booted") !== "1",
  );
  const finishBoot = useCallback(() => {
    window.sessionStorage.setItem("jarvis-booted", "1");
    setBooting(false);
  }, []);
  useEffect(() => {
    if (booting && prefersReduced) finishBoot();
    else if (booting) play("boot");
  }, [booting, prefersReduced, finishBoot, play]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const runMessage = useCallback(
    async (text: string): Promise<string | null> => {
      play("send");
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

      try {
        const res = await send.mutateAsync({
          message: text,
          conversationId: conversationIdRef.current,
        });
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
        play("response");
        setJustResponded(true);
        window.setTimeout(() => setJustResponded(false), 1600);
        if (res.actionRequests?.length) {
          setFocusActionId(res.actionRequests[0].actionRequestId);
          toast.message("A draft is ready for your approval.");
        }
        scrollToBottom();
        return res.message;
      } catch (e) {
        play("error");
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
        return null;
      }
    },
    [send, play],
  );

  const voice = useAssistantVoiceSession({
    onUtterance: runMessage,
    enabled: prefs?.voice_enabled ?? false,
  });

  const voiceActive = VOICE_ACTIVE.has(voice.state);

  // Sample mic amplitude (low rate) so the background reactor pulses during voice.
  useEffect(() => {
    if (!voiceActive) {
      setAudioLevel(0);
      return;
    }
    const id = window.setInterval(
      () => setAudioLevel(Math.min(1, voice.getLevel() * 6)),
      120,
    );
    return () => window.clearInterval(id);
  }, [voiceActive, voice]);

  const reactorMode: ReactorMode =
    voice.state === "listening" || voice.state === "capturing"
      ? "listening"
      : voice.state === "thinking" ||
          voice.state === "checking" ||
          send.isPending
        ? "thinking"
        : voice.state === "speaking"
          ? "speaking"
          : justResponded
            ? "responding"
            : "idle";

  const handleSend = (text: string) => {
    if (send.isPending) return;
    void runMessage(text);
  };

  return (
    <>
      <AnimatePresence>
        {booting && !prefersReduced && (
          <BootSequence
            assistantName={assistantName}
            accent={accent}
            onDone={finishBoot}
          />
        )}
      </AnimatePresence>

      <CommandCenterLayout
        assistantName={assistantName}
        agentKey={agentKey}
        accent={accent}
        reactorMode={reactorMode}
        audioLevel={audioLevel}
        voice={voice}
      >
        <div className="space-y-3">
          <div
            ref={scrollRef}
            className="h-[55vh] overflow-y-auto rounded-xl border bg-card/40 p-4 backdrop-blur-md"
            style={{ borderColor: `${accent}26` }}
          >
            <TranscriptPanel
              messages={messages}
              assistantName={assistantName}
              accent={accent}
              play={play}
            />
          </div>
          <PendingActionsPanel
            focusActionId={focusActionId}
            onApproved={() => play("approve")}
          />
          <CommandInput
            onSend={handleSend}
            disabled={send.isPending}
            assistantName={assistantName}
            accent={accent}
          />
        </div>
      </CommandCenterLayout>

      <VoiceImmersion
        voice={voice}
        assistantName={assistantName}
        accent={accent}
      />
    </>
  );
}
