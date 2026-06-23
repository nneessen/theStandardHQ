// src/features/call-reviews/index.ts
// All-agents Call Reviews training feature — public surface.

export { CallReviewsPage } from "./components/CallReviewsPage";
export { CallReviewDetailPage } from "./components/CallReviewDetailPage";
export { ScriptsLibraryPage, ScriptDetailPage } from "./components/scripts";

// ─── Word Tracks ↔ Sales Scripts cross-link (consumed by the Analytics
// Coaching tab to badge each word track with "used in N scripts") ────────────
export { useGeneratedScripts } from "./hooks/useCallScriptsLibrary";
export { buildWordTrackScriptUsage } from "./lib/wordTrackScriptUsage";
