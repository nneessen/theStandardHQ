#!/usr/bin/env node
// E2E for Jarvis durable memory (Phase A), against the DEPLOYED prod orchestrator.
//
// Proves the two things the unit tests (fake DB) and build cannot:
//   1. RECALL works end-to-end — the model surfaces an injected memory rather than
//      refusing it under the "answer only from tools" base rules (the figure-goal
//      case is the worst case for that clash).
//   2. A real authenticated round-trip through the live function still works
//      (regression smoke).
//
// Seeds two memories as the E2E user (REST insert under their JWT → real RLS),
// asks "what's my goal + how do I like replies", checks the streamed reply, then
// deletes the seeded rows. Read-only to everything else.
//
// Usage: node scripts/e2e-jarvis-memory.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = {};
  for (const f of [".env", ".env.local"]) {
    try {
      for (const line of readFileSync(f, "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch { /* file may not exist */ }
  }
  return env;
}

const env = loadEnv();
const URL = env.REMOTE_SUPABASE_URL;
const ANON = env.REMOTE_SUPABASE_ANON_KEY;
const EMAIL = env.E2E_EMAIL;
const PASSWORD = env.E2E_PASSWORD;
if (!URL || !ANON || !EMAIL || !PASSWORD) {
  console.error("Missing REMOTE_SUPABASE_URL / REMOTE_SUPABASE_ANON_KEY / E2E_EMAIL / E2E_PASSWORD");
  process.exit(2);
}

const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

async function main() {
  // 1. Authenticate as the real prod user.
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (authErr || !auth.session) {
    console.error("Sign-in failed:", authErr?.message);
    process.exit(1);
  }
  const token = auth.session.access_token;
  const userId = auth.user.id;
  console.log(`✓ signed in as ${EMAIL} (${userId.slice(0, 8)}…)`);

  // 2. Seed two memories (real RLS insert under the user's JWT). Tagged for cleanup.
  const TAG = "[e2e-memory-test]";
  const seed = [
    { user_id: userId, content: `${TAG} My income goal is $50,000 AP this quarter`, kind: "goal" },
    { user_id: userId, content: `${TAG} I prefer terse, bullet-point replies`, kind: "preference" },
  ];
  const { data: inserted, error: insErr } = await supabase
    .from("jarvis_memory")
    .insert(seed)
    .select("id");
  if (insErr) {
    console.error("Seed insert failed (RLS?):", insErr.message);
    process.exit(1);
  }
  console.log(`✓ seeded ${inserted.length} memories`);

  const cleanup = async () => {
    await supabase.from("jarvis_memory").delete().in("id", inserted.map((r) => r.id));
  };

  try {
    // 3. Ask the DEPLOYED orchestrator to recall — new conversation (no id), so the
    //    only way it can answer is from injected memory in the system prompt.
    const res = await fetch(`${URL}/functions/v1/assistant-orchestrator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: "What is my income goal this quarter, and how do I prefer my replies formatted?",
        conversationId: null,
      }),
    });
    if (!res.ok) {
      console.error(`✗ orchestrator HTTP ${res.status}:`, (await res.text()).slice(0, 300));
      await cleanup();
      process.exit(1);
    }

    // 4. Read the SSE stream; collect `delta` text.
    let full = "";
    const decoder = new TextDecoder();
    for await (const chunk of res.body) {
      const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        try {
          const payload = JSON.parse(t.slice(5).trim());
          if (typeof payload.text === "string") full += payload.text;
          if (payload.error) console.error("stream error event:", payload.error);
        } catch { /* non-JSON keepalive */ }
      }
    }

    const reply = full.toLowerCase();
    console.log("\n--- assistant reply ---\n" + (full || "(empty)") + "\n-----------------------\n");

    const recalledGoal = reply.includes("50,000") || reply.includes("50000") || reply.includes("50k") || reply.includes("$50");
    const recalledPref = reply.includes("terse") || reply.includes("bullet");
    const refused = /don't have|do not have|no.*(data|information).*goal|can't find|cannot find/.test(reply);

    console.log(`goal recalled:        ${recalledGoal ? "✓" : "✗"}`);
    console.log(`preference recalled:  ${recalledPref ? "✓" : "✗"}`);
    console.log(`did NOT refuse:       ${!refused ? "✓" : "✗ (model refused — BASE_SYSTEM_RULES clash)"}`);

    await cleanup();
    console.log("✓ cleaned up seeded memories");

    if (recalledGoal && recalledPref && !refused) {
      console.log("\n✅ E2E PASS — durable memory is recalled end-to-end through the live orchestrator.");
      process.exit(0);
    }
    console.log("\n❌ E2E FAIL — memory not fully recalled (see above).");
    process.exit(1);
  } catch (e) {
    console.error("E2E error:", e?.message ?? e);
    await cleanup();
    process.exit(1);
  }
}

main();
