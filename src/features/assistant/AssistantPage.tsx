import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useSendAssistantMessage } from "./hooks/useAssistant";
import { useAssistantPreferences } from "./hooks/useAssistantPreferences";
import {
  useAssistantVoiceSession,
  type AssistantVoiceSession,
} from "./hooks/useAssistantVoiceSession";
import { useKeepWarm } from "./hooks/useKeepWarm";
import { useSound } from "./hooks/useSound";
import { takeSentence } from "./lib/sentences";
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
  // runMessage is created before the voice session, so reach it through a ref.
  const voiceRef = useRef<AssistantVoiceSession | null>(null);

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
    async (
      text: string,
      opts?: { speak?: boolean },
    ): Promise<string | null> => {
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

      // When speaking, segment the streamed text into sentences and feed each to
      // the voice TTS queue as it completes — so playback starts before the whole
      // reply is generated. `flushSentences` drains complete sentences from the
      // buffer; the remainder is flushed on completion.
      const speak = opts?.speak === true;
      let speechBuf = "";
      const flushSentences = (final: boolean) => {
        if (!speak) return;
        if (final) {
          const rest = speechBuf.trim();
          if (rest) voiceRef.current?.enqueueSpeech(rest);
          speechBuf = "";
          return;
        }
        let sentence = takeSentence(speechBuf);
        while (sentence) {
          voiceRef.current?.enqueueSpeech(sentence.text);
          speechBuf = sentence.rest;
          sentence = takeSentence(speechBuf);
        }
      };

      try {
        const res = await send.mutateAsync({
          message: text,
          conversationId: conversationIdRef.current,
          onDelta: (delta) => {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === placeholderId
                  ? {
                      ...msg,
                      pending: false,
                      streaming: true,
                      content: msg.content + delta,
                    }
                  : msg,
              ),
            );
            speechBuf += delta;
            flushSentences(false);
            scrollToBottom();
          },
          onTool: (item) => {
            setMessages((m) =>
              m.map((msg) =>
                msg.id === placeholderId
                  ? {
                      ...msg,
                      toolActivity: [...(msg.toolActivity ?? []), item],
                    }
                  : msg,
              ),
            );
          },
        });
        flushSentences(true);
        if (speak) voiceRef.current?.finishSpeech();
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
                  streaming: false,
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
        // In voice mode, don't resolve until the spoken reply finishes playing,
        // so the voice loop doesn't reopen the mic mid-sentence.
        if (speak) await voiceRef.current?.speechIdle();
        return res.message;
      } catch (e) {
        if (speak) voiceRef.current?.cancelSpeech();
        play("error");
        setMessages((m) =>
          m.map((msg) =>
            msg.id === placeholderId
              ? {
                  id: placeholderId,
                  role: "assistant",
                  content:
                    "Sorry — I couldn't complete that. Please try again.",
                  streaming: false,
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

  // Keep the STT/orchestrator/TTS edge functions hot while the command center is
  // open so a turn never eats a triple cold start. Enabled whenever the page is
  // mounted (route is already gated to authorized users).
  const { warm } = useKeepWarm(true);

  const voice = useAssistantVoiceSession({
    onUtterance: (text) => runMessage(text, { speak: true }),
    enabled: prefs?.voice_enabled ?? false,
  });
  voiceRef.current = voice;

  const voiceActive = VOICE_ACTIVE.has(voice.state);

  // Pre-warm the moment speech is detected: it boots any cold isolate during the
  // 1.1s the VAD spends confirming end-of-utterance, so STT/orchestrator run hot.
  useEffect(() => {
    if (voice.state === "capturing") void warm();
  }, [voice.state, warm]);

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
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto pr-1 lg:max-h-[44vh] lg:flex-none [mask-image:linear-gradient(to_bottom,transparent_0,black_14%)]"
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
      </CommandCenterLayout>

      <VoiceImmersion
        voice={voice}
        assistantName={assistantName}
        accent={accent}
      />
    </>
  );
}
