import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useSendAssistantMessage } from "./hooks/useAssistant";
import { useAssistantPreferences } from "./hooks/useAssistantPreferences";
import {
  useAssistantVoiceSession,
  type AssistantVoiceSession,
} from "./hooks/useAssistantVoiceSession";
import { useJarvisVoiceSession } from "./hooks/useJarvisVoiceSession";
import type { VoiceSessionUi } from "./hooks/voiceSession.types";
import { useKeepWarm } from "./hooks/useKeepWarm";
import { useSound } from "./hooks/useSound";
import { takeSentence } from "./lib/sentences";
import {
  consumeVoiceLaunch,
  subscribeVoiceLaunch,
} from "./lib/voiceLaunchSignal";
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
  // The LEGACY voice hook drives the browser-side TTS queue; runMessage reaches it through
  // a ref (it's created before the hook). The realtime path needs none of this — its worker
  // speaks the reply — so this ref always points at the legacy session.
  const speechRef = useRef<AssistantVoiceSession | null>(null);
  // The ACTIVE voice session (legacy or realtime) for the ⌘J launch shortcut.
  const activeVoiceRef = useRef<VoiceSessionUi | null>(null);

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
          if (rest) speechRef.current?.enqueueSpeech(rest);
          speechBuf = "";
          return;
        }
        let sentence = takeSentence(speechBuf);
        while (sentence) {
          speechRef.current?.enqueueSpeech(sentence.text);
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
        if (speak) speechRef.current?.finishSpeech();
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
        if (speak) await speechRef.current?.speechIdle();
        return res.message;
      } catch (e) {
        if (speak) speechRef.current?.cancelSpeech();
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

  const voiceEnabled = prefs?.voice_enabled ?? false;
  const realtimeEnabled = prefs?.voice_engine === "realtime";

  // Keep the voice edge functions hot while the command center is open so the first turn
  // doesn't eat a cold start. The ORCHESTRATOR is warmed on BOTH paths (legacy and realtime
  // both call it). The legacy STT/TTS edge functions are warmed only on the legacy path — the
  // realtime worker does STT/TTS server-side and never touches them. Off when voice is disabled.
  const { warm } = useKeepWarm(voiceEnabled, !realtimeEnabled);

  // Both hooks are called unconditionally (React hook rules); only the SELECTED one is ever
  // started. Legacy drives browser STT/TTS via onUtterance→runMessage; realtime is a LiveKit
  // transport whose persistent worker owns the whole pipeline (so it has no onUtterance).
  const legacyVoice = useAssistantVoiceSession({
    onUtterance: (text) => runMessage(text, { speak: true }),
    enabled: voiceEnabled && !realtimeEnabled,
  });
  const realtimeVoice = useJarvisVoiceSession({
    enabled: voiceEnabled && realtimeEnabled,
  });
  const voice: VoiceSessionUi = realtimeEnabled ? realtimeVoice : legacyVoice;
  speechRef.current = legacyVoice;
  activeVoiceRef.current = voice;

  // Stable handles to each hook's stop() (the hook objects are fresh every render).
  const legacyStopRef = useRef(legacyVoice.stop);
  legacyStopRef.current = legacyVoice.stop;
  const realtimeStopRef = useRef(realtimeVoice.stop);
  realtimeStopRef.current = realtimeVoice.stop;

  // When the transport selection flips (user toggles Realtime voice mid-session), tear
  // down the now-inactive hook. Otherwise a running session on the other transport leaks —
  // e.g. the legacy mic stays open and keeps transcribing with no UI left to stop it,
  // since the orb/immersion now track the newly-selected hook. stop() is a no-op when that
  // hook is already idle.
  useEffect(() => {
    if (realtimeEnabled) legacyStopRef.current();
    else realtimeStopRef.current();
  }, [realtimeEnabled]);

  // Audible "you can talk now": chime the instant the agent flips into listening (from
  // connecting/speaking/etc.). The immersion shows a green READY pill at the same moment —
  // together they make the disabled→ready transition impossible to miss. Gated on sound_enabled
  // via play().
  const prevVoiceStateRef = useRef<VoiceSessionUi["state"]>(voice.state);
  useEffect(() => {
    const prev = prevVoiceStateRef.current;
    if (prev !== "listening" && voice.state === "listening") play("ready");
    prevVoiceStateRef.current = voice.state;
  }, [voice.state, play]);

  // ⌘J (from anywhere) lands here and asks us to begin voice immediately so the
  // user can just talk. Mirror the orb's click guard: skip if a session is
  // already running, surface the same notice if the backend probe says voice
  // isn't configured, otherwise start. Read live state through activeVoiceRef since the
  // request can arrive asynchronously. Wait out the one-time boot overlay so the
  // mic permission prompt doesn't appear behind a full-screen animation.
  useEffect(() => {
    if (booting) return; // pending request is preserved until boot finishes
    const launch = () => {
      const v = activeVoiceRef.current;
      if (!v || VOICE_ACTIVE.has(v.state)) return;
      if (v.available === false) {
        toast.info("Voice isn't configured yet. Text chat is fully available.");
        return;
      }
      void v.start();
    };
    if (consumeVoiceLaunch()) launch();
    return subscribeVoiceLaunch(launch);
  }, [booting]);

  // The agent is actually HEARING the user only in these states; gate live-mic sampling on it
  // so the reactor never pulses to the mic while connecting/speaking — which would falsely
  // read as "I'm listening" before it really is.
  const voiceHearing =
    voice.state === "listening" || voice.state === "capturing";

  // Pre-warm the moment speech is detected: it boots any cold isolate during the
  // 1.1s the VAD spends confirming end-of-utterance, so STT/orchestrator run hot.
  useEffect(() => {
    if (voice.state === "capturing") void warm();
  }, [voice.state, warm]);

  // Sample mic amplitude (low rate) so the background reactor pulses while the agent is
  // actually listening — held flat (0) otherwise so connecting/speaking reads as not-yet.
  useEffect(() => {
    if (!voiceHearing) {
      setAudioLevel(0);
      return;
    }
    const id = window.setInterval(
      () => setAudioLevel(Math.min(1, voice.getLevel() * 6)),
      120,
    );
    return () => window.clearInterval(id);
  }, [voiceHearing, voice]);

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
        onRunPrompt={handleSend}
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
