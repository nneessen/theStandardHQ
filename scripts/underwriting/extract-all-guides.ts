/**
 * scripts/underwriting/extract-all-guides.ts
 *
 * Phase 3 — Bulk extraction queue
 *
 * Iterates every parsed underwriting guide that has no AI-extracted candidates
 * yet and invokes the extract-underwriting-rules edge function for each.
 * Useful for backfilling carriers that are at zero rules (Liberty Bankers,
 * American Home Life, F&G).
 *
 * Required env (sourced from .env if present):
 *   - REMOTE_DATABASE_URL  (or DATABASE_URL)  — only used to derive project ref
 *   - SUPABASE_URL                           — e.g. https://xxx.supabase.co
 *   - SUPABASE_SERVICE_ROLE_KEY              — used for direct DB queries (read-only)
 *   - ADMIN_JWT                              — user JWT of an admin/super-admin
 *                                              (sign in to the app, open devtools,
 *                                              copy `access_token` from the
 *                                              `sb-<ref>-auth-token` localStorage entry)
 *
 * Optional env:
 *   - DRY_RUN=1         — list candidates without invoking the edge function
 *   - GUIDE_ID=<uuid>   — only extract for this single guide
 *   - REEXTRACT=1       — re-run even if candidates already exist
 *
 * Run:
 *   source .env && npx tsx scripts/underwriting/extract-all-guides.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ADMIN_JWT = process.env.ADMIN_JWT ?? "";
const DRY_RUN = process.env.DRY_RUN === "1";
const REEXTRACT = process.env.REEXTRACT === "1";
const SINGLE_GUIDE_ID = process.env.GUIDE_ID ?? null;

if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL env var");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}
if (!DRY_RUN && !ADMIN_JWT) {
  console.error(
    "Missing ADMIN_JWT env var (required unless DRY_RUN=1). See script header.",
  );
  process.exit(1);
}

interface GuideRow {
  id: string;
  name: string;
  carrier_id: string;
  carrier_name: string;
  parsing_status: string | null;
  has_candidates: boolean;
}

interface ExtractResponse {
  success: boolean;
  guideId: string;
  setsCreated: number;
  rulesCreated: number;
  errors: string[];
  aiDurationMs: number;
  totalDurationMs: number;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

async function main() {
  console.log(
    `\n=== Bulk Underwriting Rule Extraction ===\nMode: ${DRY_RUN ? "DRY RUN" : REEXTRACT ? "RE-EXTRACT" : "EXTRACT (skip if candidates exist)"}\n`,
  );

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Fetch parsed guides + their carriers
  let guideQuery = adminClient
    .from("underwriting_guides")
    .select("id, name, carrier_id, parsing_status, carriers(name)")
    .eq("parsing_status", "completed");

  if (SINGLE_GUIDE_ID) {
    guideQuery = guideQuery.eq("id", SINGLE_GUIDE_ID);
  }

  const { data: guides, error: guidesError } = await guideQuery;
  if (guidesError) {
    console.error("Failed to load guides:", guidesError.message);
    process.exit(1);
  }
  if (!guides || guides.length === 0) {
    console.log("No parsed guides found. Nothing to do.");
    return;
  }

  // 2. Fetch existing rule-set guide IDs to know which guides already have candidates
  const guideIds = guides.map((g) => g.id as string);
  const { data: existingSets, error: setsError } = await adminClient
    .from("underwriting_rule_sets")
    .select("source_guide_id")
    .in("source_guide_id", guideIds)
    .not("source_guide_id", "is", null);
  if (setsError) {
    console.error("Failed to query existing rule sets:", setsError.message);
    process.exit(1);
  }
  const guidesWithCandidates = new Set(
    (existingSets ?? [])
      .map((r) => r.source_guide_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  const rows: GuideRow[] = guides.map((g) => {
    const carrier = g.carriers as { name?: string } | null;
    return {
      id: g.id as string,
      name: g.name as string,
      carrier_id: g.carrier_id as string,
      carrier_name: carrier?.name ?? "(unknown carrier)",
      parsing_status: g.parsing_status as string | null,
      has_candidates: guidesWithCandidates.has(g.id as string),
    };
  });

  const eligible = REEXTRACT ? rows : rows.filter((r) => !r.has_candidates);

  console.log(
    `Found ${rows.length} parsed guide(s). ${eligible.length} eligible for extraction (${rows.length - eligible.length} already have candidates).\n`,
  );

  if (eligible.length === 0) {
    console.log(
      "All parsed guides already have candidates. Use REEXTRACT=1 to re-run.",
    );
    return;
  }

  for (const row of eligible) {
    console.log(
      `[${row.carrier_name}] ${row.name} (${row.id})${row.has_candidates ? " — re-extracting" : ""}`,
    );
  }

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 set — exiting without invoking edge function.");
    return;
  }

  // 3. Invoke edge function for each eligible guide using admin JWT
  console.log("\nInvoking extract-underwriting-rules per guide...\n");

  let totalSets = 0;
  let totalRules = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const failures: { guideId: string; error: string }[] = [];

  for (const row of eligible) {
    process.stdout.write(`  → ${row.carrier_name} / ${row.name}... `);
    const start = Date.now();
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/extract-underwriting-rules`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ADMIN_JWT}`,
          },
          body: JSON.stringify({ guideId: row.id }),
        },
      );

      const json = (await response.json()) as ExtractResponse;
      if (!response.ok || !json.success) {
        failures.push({
          guideId: row.id,
          error: json.error ?? `HTTP ${response.status}`,
        });
        console.log(`FAILED — ${json.error ?? response.statusText}`);
        continue;
      }

      totalSets += json.setsCreated;
      totalRules += json.rulesCreated;
      if (json.usage) {
        totalInputTokens += json.usage.inputTokens;
        totalOutputTokens += json.usage.outputTokens;
      }

      const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
      console.log(
        `${json.setsCreated} sets / ${json.rulesCreated} rules in ${elapsedSec}s${json.errors.length > 0 ? ` (with ${json.errors.length} warnings)` : ""}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ guideId: row.id, error: message });
      console.log(`ERROR — ${message}`);
    }
  }

  // 4. Summary
  console.log("\n=== Summary ===");
  console.log(`Guides processed:       ${eligible.length}`);
  console.log(`Sets created:           ${totalSets}`);
  console.log(`Rules created:          ${totalRules}`);
  console.log(`Failures:               ${failures.length}`);
  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    // Sonnet 4.5 pricing: $3/MTok input, $15/MTok output (subject to change)
    const estCost =
      (totalInputTokens / 1_000_000) * 3 + (totalOutputTokens / 1_000_000) * 15;
    console.log(
      `Token usage:            ${totalInputTokens.toLocaleString()} in / ${totalOutputTokens.toLocaleString()} out`,
    );
    console.log(`Est. Anthropic cost:    $${estCost.toFixed(4)}`);
  }
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f.guideId}: ${f.error}`);
    }
  }
  console.log(
    "\nReview the candidates in the app at /underwriting/guides/<guide-id>/extracted-rules\n",
  );
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
