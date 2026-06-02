// Shared voice-session surface. The command-center voice UI (VoiceOrb, VoiceImmersion,
// CommandCenterLayout) depends ONLY on this interface, so it can render either voice
// transport interchangeably:
//   - legacy   (useAssistantVoiceSession) — browser MediaRecorder + Whisper + MediaSource
//   - realtime (useJarvisVoiceSession)     — LiveKit Agents worker (WebRTC + Deepgram + ElevenLabs)
// AssistantPage picks which hook drives the UI based on the user's voice_engine preference.

export type VoiceSessionState =
  | "idle"
  | "checking" // starting up / connecting
  | "unavailable" // no mic / unsupported / backend not configured
  | "listening" // mic open, waiting for / hearing speech
  | "capturing" // user is actively speaking
  | "thinking" // transcribing + brain running
  | "speaking"; // playing the spoken reply

/** The minimal surface both voice hooks expose to the UI. */
export interface VoiceSessionUi {
  state: VoiceSessionState;
  /** A user-facing notice (mic denied, not configured, etc.) or null. */
  message: string | null;
  /** Availability probe result: true/false once known, null while unknown. */
  available: boolean | null;
  /** Begin a hands-free session (prompts for mic). */
  start: () => Promise<void>;
  /** End the session and release the mic. */
  stop: () => void;
  /** Fill `out` with byte frequency data from the live mic analyser; false if no session. */
  getFrequencyData: (out: Uint8Array) => boolean;
  /** Last measured mic RMS amplitude (0–1), for visualizers. */
  getLevel: () => number;
}
