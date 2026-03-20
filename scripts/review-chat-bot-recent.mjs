#!/usr/bin/env node

import {
  createRuntime,
  loadAgents,
  loadAgentBundle,
  buildReview,
  saveReview,
  parseArgs,
  parseHoursAgo,
  resolveReviewMode,
  loadExistingReviewedConversationIds,
  listRecentAgentConversations,
} from "./lib/chat-bot-review-runtime.mjs";

function printUsage() {
  console.error(`Usage:
  npm run bot:review:recent -- [--since-hours 24] [--limit 50]

Optional:
  --agent-id <externalAgentId>
  --user-id <commissionTrackerUserId>
  --mode diagnostic|improve
  --improve
  --save
  --skip-existing
  --json
`);
}

function groupByPrimaryReason(reviews) {
  const counts = new Map();

  for (const review of reviews) {
    const code = review.summary.primaryReasonCode;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === true) {
    printUsage();
    process.exit(0);
  }

  const runtime = createRuntime(process.cwd());
  const supabase = runtime.supabase;
  const agents = await loadAgents(supabase, {
    agentId: args["agent-id"],
    userId: args["user-id"],
  });

  if (agents.length === 0) {
    throw new Error("No active chat bot agents matched the supplied filters.");
  }

  const sinceIso =
    typeof args["since-hours"] === "string"
      ? parseHoursAgo(args["since-hours"], 24)
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.max(1, Number(args.limit || 50));
  const mode = resolveReviewMode(args);
  const shouldSave = args.save === true;
  const shouldSkipExisting = args["skip-existing"] === true || shouldSave;
  const existingIds = shouldSkipExisting
    ? await loadExistingReviewedConversationIds(supabase, runtime.env, {
        sinceIso,
      })
    : new Set();

  const reviews = [];
  const saved = [];
  let scanned = 0;

  for (const agent of agents) {
    const conversations = await listRecentAgentConversations(
      runtime.apiUrl,
      runtime.apiKey,
      {
        agentId: agent.external_agent_id,
        sinceIso,
        limit,
      },
    );

    for (const conversation of conversations) {
      if (reviews.length >= limit) break;
      scanned += 1;

      if (
        shouldSkipExisting &&
        conversation.id &&
        existingIds.has(conversation.id)
      ) {
        continue;
      }

      const bundle = await loadAgentBundle(
        runtime.apiUrl,
        runtime.apiKey,
        agent.external_agent_id,
        conversation.id,
      );

      const review = buildReview({
        target: {
          leadId: conversation.closeLeadId ?? null,
          conversationId: conversation.id,
          leadPhone: conversation.leadPhone ?? null,
          leadName: conversation.leadName ?? null,
          from: sinceIso,
        },
        agent,
        conversation,
        bundle,
      });

      reviews.push(review);

      if (shouldSave) {
        const savedRow = await saveReview({
          supabase,
          env: runtime.env,
          review,
          mode,
        });
        saved.push(savedRow);
        if (conversation.id) existingIds.add(conversation.id);
      }
    }

    if (reviews.length >= limit) break;
  }

  if (args.json === true) {
    process.stdout.write(
      `${JSON.stringify(
        {
          sinceIso,
          scanned,
          reviewed: reviews.length,
          saved: saved.length,
          primaryReasonCounts: groupByPrimaryReason(reviews).map(
            ([code, count]) => ({ code, count }),
          ),
          reviews: reviews.map((review) => ({
            leadId: review.target.leadId,
            conversationId: review.conversation?.id ?? null,
            primaryReasonCode: review.summary.primaryReasonCode,
            primaryReason: review.summary.primaryReason,
          })),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const lines = [];
  lines.push(`Since: ${sinceIso}`);
  lines.push(`Scanned conversations: ${scanned}`);
  lines.push(`Reviewed conversations: ${reviews.length}`);
  lines.push(`Saved reviews: ${saved.length}`);
  lines.push("");
  lines.push("Primary reasons:");

  for (const [code, count] of groupByPrimaryReason(reviews)) {
    lines.push(`- ${code}: ${count}`);
  }

  if (reviews.length > 0) {
    lines.push("");
    lines.push("Sample cases:");
    for (const review of reviews.slice(0, 10)) {
      lines.push(
        `- ${review.target.leadId ?? "no-lead-id"} | ${review.conversation?.id ?? "no-conversation"} | ${review.summary.primaryReasonCode}`,
      );
    }
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
