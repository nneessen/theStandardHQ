#!/usr/bin/env node
// validate-vizard-contract.mjs — STEP 0 for the YouTube→Reels feature.
//
// Confirms the Vizard API response contract against a REAL call BEFORE we rely on it in the
// reels-poll cron. It hits project/create then polls project/query, printing the raw response
// shapes so we can verify: the success `code` (docs say 2000) and the `videos[]` field names
// (videoUrl, viralScore, videoMsDuration, title, transcript, videoId, viralReason).
//
// Usage:
//   VIZARD_API_KEY=sk-... node scripts/validate-vizard-contract.mjs "https://www.youtube.com/watch?v=XXXX"
//
// Notes:
//   - Uses a video YOU OWN. Costs ~1 Vizard credit per minute of the source video.
//   - Polls for up to ~12 minutes. Safe to Ctrl-C; nothing is written to our DB.

const API_KEY = process.env.VIZARD_API_KEY;
const videoUrl = process.argv[2];

const CREATE_URL =
  "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/create";
const QUERY_BASE =
  "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/query/";

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!API_KEY) die("Set VIZARD_API_KEY in the environment.");
if (!videoUrl) die('Pass a YouTube URL: node scripts/validate-vizard-contract.mjs "https://youtube.com/watch?v=..."');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function summarizeVideos(payload) {
  const videos = Array.isArray(payload?.videos) ? payload.videos : null;
  if (!videos) {
    console.log("  (no `videos` array at top level — keys present:", Object.keys(payload || {}), ")");
    return;
  }
  console.log(`  videos[] length: ${videos.length}`);
  if (videos[0]) {
    console.log("  first clip keys:", Object.keys(videos[0]));
    const v = videos[0];
    console.log("  sample field reads:", {
      videoUrl: v.videoUrl,
      viralScore: v.viralScore,
      videoMsDuration: v.videoMsDuration,
      title: v.title,
      videoId: v.videoId,
      viralReason: typeof v.viralReason === "string" ? v.viralReason.slice(0, 60) + "…" : v.viralReason,
      transcript: typeof v.transcript === "string" ? `[${v.transcript.length} chars]` : v.transcript,
    });
  }
}

async function main() {
  console.log("=== STEP 1: project/create ===");
  const createResp = await fetch(CREATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", VIZARDAI_API_KEY: API_KEY },
    body: JSON.stringify({
      lang: "en",
      videoUrl,
      videoType: 2, // YouTube
      ratioOfClip: 1, // 9:16
      subtitleSwitch: 1,
      headlineSwitch: 0,
      maxClipNumber: 3,
    }),
  });
  const createJson = await createResp.json().catch(() => ({}));
  console.log("HTTP status:", createResp.status);
  console.log("top-level keys:", Object.keys(createJson));
  console.log("raw body:", JSON.stringify(createJson, null, 2).slice(0, 1500));

  const projectId =
    createJson.projectId ?? createJson?.data?.projectId ?? createJson?.project_id;
  if (!projectId) die("Could not find projectId in the create response (see body above).");
  console.log(`\n✓ projectId = ${projectId}\n`);

  console.log("=== STEP 2: project/query (polling) ===");
  const start = Date.now();
  const MAX_MS = 12 * 60 * 1000;
  let tick = 0;
  while (Date.now() - start < MAX_MS) {
    tick++;
    const qResp = await fetch(QUERY_BASE + projectId, {
      method: "GET",
      headers: { VIZARDAI_API_KEY: API_KEY },
    });
    const qJson = await qResp.json().catch(() => ({}));
    const code = qJson?.code;
    console.log(
      `[poll ${tick}] HTTP ${qResp.status} | code=${code} | keys=${JSON.stringify(Object.keys(qJson))}`,
    );

    // 2000 = done per docs. Anything with a populated videos[] is also "done".
    if (code === 2000 || (Array.isArray(qJson?.videos) && qJson.videos.length > 0)) {
      console.log("\n✓ DONE. Response shape:");
      summarizeVideos(qJson);
      console.log("\n=== CONTRACT CONFIRMED — compare these against reels-poll/index.ts ===");
      console.log("  done code:", code, "(reels-poll expects 2000)");
      console.log("  full body (truncated):");
      console.log(JSON.stringify(qJson, null, 2).slice(0, 4000));
      return;
    }
    await sleep(30_000);
  }
  die("Timed out after 12 minutes without a done code. Inspect the [poll] lines above.");
}

main().catch((e) => die(e?.stack || String(e)));
