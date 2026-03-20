#!/usr/bin/env node

import { formatChatBotLeadReview } from "./lib/chat-bot-review.mjs";
import {
  buildReview,
  createRuntime,
  loadAgentBundle,
  loadAgents,
  parseArgs,
  resolveReviewMode,
  resolveTargetConversation,
  saveReview,
} from "./lib/chat-bot-review-runtime.mjs";

function printUsage() {
  console.error(`Usage:
  npm run bot:review -- --lead-id <closeLeadId> [--json] [--save]
  npm run bot:review -- --conversation-id <conversationId> [--json] [--save]
  npm run bot:review -- --lead-phone <phone> --lead-name "<name>" [--json] [--save]
  npm run bot:review -- --lead-name <name> [--json] [--save]

Optional filters:
  --agent-id <externalAgentId>
  --user-id <commissionTrackerUserId>
  --mode diagnostic|improve
  --improve
  --save
  --prompt-version <version>
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = {
    leadId: typeof args["lead-id"] === "string" ? args["lead-id"] : null,
    conversationId:
      typeof args["conversation-id"] === "string"
        ? args["conversation-id"]
        : null,
    leadPhone:
      typeof args["lead-phone"] === "string" ? args["lead-phone"] : null,
    leadName: typeof args["lead-name"] === "string" ? args["lead-name"] : null,
    from: typeof args.from === "string" ? args.from : null,
  };

  if (
    !target.leadId &&
    !target.conversationId &&
    !target.leadPhone &&
    !target.leadName
  ) {
    printUsage();
    process.exit(1);
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

  const resolved = await resolveTargetConversation(
    runtime.apiUrl,
    runtime.apiKey,
    agents,
    target,
  );

  const agent = resolved?.agent ?? agents[0];
  const conversation = resolved?.conversation ?? null;
  const bundle = await loadAgentBundle(
    runtime.apiUrl,
    runtime.apiKey,
    agent.external_agent_id,
    conversation?.id ?? null,
  );

  const review = buildReview({
    target,
    agent,
    conversation,
    bundle,
  });
  const mode = resolveReviewMode(args);
  let savedReview = null;

  if (args.save === true) {
    savedReview = await saveReview({
      supabase,
      env: runtime.env,
      review,
      mode,
      promptVersion:
        typeof args["prompt-version"] === "string"
          ? args["prompt-version"]
          : null,
      });
  }

  process.stdout.write(
    formatChatBotLeadReview(review, {
      asJson: args.json === true,
      mode,
    }),
  );

  if (savedReview && args.json !== true) {
    process.stdout.write(
      `Saved review: ${savedReview.id} at ${savedReview.created_at}\n`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
