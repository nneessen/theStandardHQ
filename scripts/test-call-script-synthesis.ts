// test-call-script-synthesis.ts — E2E test of the Sales Scripts SYNTHESIS path.
// Imports the ACTUAL shipped helpers from the edge function (synthesis.ts), pulls
// the seeded Cash Out sold calls from the LOCAL db, builds digests, calls Anthropic
// for the reduce, and runs normalizeScript — then validates the result matches the
// renderer contract (src/features/call-reviews/types.ts GeneratedScript).
//
// Prereqs: local supabase up + scripts/seed-call-scripts-content.sql applied.
// Run (LOCAL — defaults to the seeded local Cash Out at the shipped cap):
//   set -a; source .env; set +a
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY="<local service_role>" \
//   deno run --allow-net --allow-env scripts/test-call-script-synthesis.ts
//
// Run (PROD — point at any real IMO/call-type; mirrors the deployed fn's cap):
//   set -a; source .env; set +a
//   SUPABASE_URL="$REMOTE_SUPABASE_URL" \
//   SUPABASE_SERVICE_ROLE_KEY="$REMOTE_SUPABASE_SERVICE_ROLE_KEY" \
//   IMO=<imo-uuid> CALL_TYPE=<call-type-uuid> MAX_TOKENS=16384 \
//   deno run --allow-net --allow-env scripts/test-call-script-synthesis.ts
//
// IMO, CALL_TYPE, and MAX_TOKENS are overridable via env; defaults below target
// the local seeded data at the function's shipped MAX_REDUCE_TOKENS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";
import {
  buildDigest,
  normalizeScript,
  parseJson,
  systemPrompt,
  userPrompt,
  type SourceCall,
  type WordTrack,
} from "../supabase/functions/generate-call-script/synthesis.ts";

const IMO = Deno.env.get("IMO") ?? "2fd256e9-9abb-445e-b405-62436555648a";
const CALL_TYPE =
  Deno.env.get("CALL_TYPE") ?? "91cae9ee-e7b5-495f-b7b3-79aae721b5e8"; // Cash Out
const MODEL = "claude-sonnet-4-6";
// Mirror the edge fn's MAX_REDUCE_TOKENS so this test exercises the SAME cap the
// deployed function uses (6144 truncated real 5-call syntheses; 16384 is current).
const MAX_TOKENS = Number(Deno.env.get("MAX_TOKENS") ?? "16384");

const url = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
if (!key || !anthropicKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or ANTHROPIC_API_KEY.");
  Deno.exit(2);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const fail = (m: string) => {
  console.error("❌ " + m);
  Deno.exit(1);
};

// 1. Gather (mirrors the edge fn's gather query)
const { data: ct } = await db
  .from("kpi_call_types")
  .select("name")
  .eq("id", CALL_TYPE)
  .maybeSingle();
const callTypeName = ct?.name ?? "Cash Out";

const { data: callsRaw, error: gErr } = await db
  .from("kpi_call_recordings")
  .select(
    "id, ai_summary, ai_key_moments, objection_events, transcript_segments, speaker_role_map, duration_seconds",
  )
  .eq("imo_id", IMO)
  .eq("call_type_id", CALL_TYPE)
  .eq("outcome", "sold")
  .eq("analysis_status", "completed")
  .eq("transcription_status", "completed")
  .order("call_at", { ascending: false })
  .limit(15);
if (gErr) fail("gather: " + gErr.message);
const calls = (callsRaw ?? []) as SourceCall[];
console.log(`• gathered ${calls.length} sold calls for "${callTypeName}"`);
if (calls.length < 3) fail(`floor not met (${calls.length} < 3)`);

const { data: tracksRaw } = await db
  .from("kpi_word_tracks")
  .select("id, label, phrase, category")
  .eq("imo_id", IMO)
  .eq("is_active", true)
  .in("scope", ["team", "imo"]);
const tracks = (tracksRaw ?? []) as WordTrack[];
console.log(`• ${tracks.length} word tracks in library`);

// 2. Digests (bounded check)
const digests = calls.map((c, i) => buildDigest(c, i));
const maxLen = Math.max(...digests.map((d) => d.length));
console.log(`• built ${digests.length} digests (max ${maxLen} chars)`);
if (maxLen > 7200) fail("a digest exceeded the char cap");

// 3. Anthropic reduce (the real call)
console.log(`• calling Anthropic (sonnet reduce, max_tokens=${MAX_TOKENS})…`);
const client = new Anthropic({ apiKey: anthropicKey });
const response = await client.messages.create({
  model: MODEL,
  max_tokens: MAX_TOKENS,
  system: systemPrompt(),
  messages: [
    { role: "user", content: userPrompt(callTypeName, digests, tracks) },
  ],
});
const tokens =
  (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
console.log(
  `• reduce done: stop_reason=${response.stop_reason}, tokens=${tokens}`,
);
if (response.stop_reason === "max_tokens") fail("response truncated");

const rawText = response.content
  .filter((b: { type: string }) => b.type === "text")
  .map((b: { text: string }) => b.text)
  .join("");

// 4. Validate + normalize (the actual shipped validator)
let body;
try {
  body = normalizeScript(parseJson(rawText), callTypeName, tracks);
} catch (e) {
  console.error(
    "raw model output (first 600 chars):\n" + rawText.slice(0, 600),
  );
  fail("normalizeScript: " + (e instanceof Error ? e.message : String(e)));
}

// 5. Contract assertions (renderer expects these)
const b = body as Record<string, unknown>;
const phases = Array.isArray(b.phases) ? b.phases : [];
if (phases.length === 0) fail("no phases produced");

let stepCount = 0,
  objCount = 0,
  pauseCount = 0,
  toneCount = 0,
  wtCount = 0;
for (const ph of phases as Record<string, unknown>[]) {
  if (typeof ph.title !== "string" || !ph.title) fail("phase missing title");
  if (!Array.isArray(ph.steps) || ph.steps.length === 0)
    fail("phase has no steps");
  for (const st of ph.steps as Record<string, unknown>[]) {
    stepCount++;
    if (!["say", "ask", "do", "transition"].includes(st.kind as string))
      fail("step has invalid kind: " + st.kind);
    if (!Array.isArray(st.word_track_ids))
      fail("step.word_track_ids not array");
    if (!Array.isArray(st.objections)) fail("step.objections not array");
    if (st.kind !== "do" && !st.say) fail("say-step has empty say");
    objCount += (st.objections as unknown[]).length;
    wtCount += (st.word_track_ids as unknown[]).length;
    if (st.pause_cue) pauseCount++;
    if (st.tonality) toneCount++;
  }
}

console.log("\n✅ SYNTHESIS CONTRACT OK");
console.log(`   call_type:        ${b.call_type}`);
console.log(`   phases:           ${phases.length}`);
console.log(`   steps:            ${stepCount}`);
console.log(`   key_principles:   ${(b.key_principles as unknown[]).length}`);
console.log(
  `   placeholders:     ${(b.placeholders_used as unknown[]).length}`,
);
console.log(`   step pause cues:  ${pauseCount}`);
console.log(`   step tonalities:  ${toneCount}`);
console.log(`   step objections:  ${objCount}`);
console.log(`   word-track links: ${wtCount} (server re-anchored to real ids)`);
console.log(
  "\n--- phase outline ---\n" +
    (phases as Record<string, unknown>[])
      .map(
        (p, i) =>
          `${i + 1}. ${p.title}  (${(p.steps as unknown[]).length} steps` +
          `${p.call_pct != null ? `, ~${p.call_pct}%` : ""})`,
      )
      .join("\n"),
);

// Show one fully-annotated step so a human can eyeball the quality.
const sample = (phases as Record<string, unknown>[])
  .flatMap((p) => p.steps as Record<string, unknown>[])
  .find((s) => (s.objections as unknown[]).length > 0 || s.pause_cue);
if (sample) {
  console.log("\n--- sample annotated step ---");
  console.log(JSON.stringify(sample, null, 2));
}
