import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

import {
  analyzeChatBotLeadReview,
  buildChatBotImprovementBrief,
} from "./chat-bot-review.mjs";

export function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

export function resolveReviewMode(args) {
  if (args.improve === true || args.mode === "improve") {
    return "improve";
  }

  return "diagnostic";
}

export function loadEnv(projectRoot) {
  const envFiles = [".env", ".env.local"];
  const merged = {};

  for (const envFile of envFiles) {
    const filePath = path.join(projectRoot, envFile);
    if (!fs.existsSync(filePath)) continue;
    Object.assign(merged, dotenv.parse(fs.readFileSync(filePath)));
  }

  return merged;
}

function unwrapPayload(response) {
  return response?.data ?? response;
}

export function createRuntime(projectRoot = process.cwd()) {
  const env = loadEnv(projectRoot);
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const apiUrl = env.CHAT_BOT_API_URL;
  const apiKey = env.CHAT_BOT_API_KEY;

  if (!supabaseUrl || !supabaseKey || !apiUrl || !apiKey) {
    throw new Error(
      "Missing required env keys. Need Supabase URL, service role key, chat bot API URL, and chat bot API key.",
    );
  }

  return {
    env,
    apiUrl,
    apiKey,
    supabase: createClient(supabaseUrl, supabaseKey),
  };
}

async function insertReviewViaPostgres(connectionString, payload) {
  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL for direct Postgres fallback while saving review.",
    );
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const query = `
      insert into public.chat_bot_conversation_reviews (
        user_id,
        external_agent_id,
        external_conversation_id,
        close_lead_id,
        review_mode,
        primary_reason_code,
        primary_reason,
        found_conversation,
        conversation_status,
        outbound_count,
        inbound_count,
        prompt_version,
        human_verdict,
        resolution_status,
        target_payload,
        findings,
        timeline,
        gaps,
        improvement_brief,
        agent_snapshot,
        conversation_snapshot,
        review_payload
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, $19, $20::jsonb,
        $21::jsonb, $22::jsonb
      )
      returning id, created_at, primary_reason_code, external_conversation_id
    `;

    const values = [
      payload.user_id,
      payload.external_agent_id,
      payload.external_conversation_id,
      payload.close_lead_id,
      payload.review_mode,
      payload.primary_reason_code,
      payload.primary_reason,
      payload.found_conversation,
      payload.conversation_status,
      payload.outbound_count,
      payload.inbound_count,
      payload.prompt_version,
      payload.human_verdict,
      payload.resolution_status,
      JSON.stringify(payload.target_payload),
      JSON.stringify(payload.findings),
      JSON.stringify(payload.timeline),
      JSON.stringify(payload.gaps),
      payload.improvement_brief,
      JSON.stringify(payload.agent_snapshot),
      JSON.stringify(payload.conversation_snapshot),
      JSON.stringify(payload.review_payload),
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  } finally {
    await client.end();
  }
}

async function loadReviewedConversationIdsViaPostgres(
  connectionString,
  { sinceIso, agentId = null, userId = null },
) {
  if (!connectionString) {
    throw new Error(
      "Missing remote database connection string for direct Postgres dedupe fallback.",
    );
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const query = `
      select external_conversation_id
      from public.chat_bot_conversation_reviews
      where external_conversation_id is not null
        and created_at >= $1
        and ($2::text is null or external_agent_id = $2)
        and ($3::uuid is null or user_id = $3)
    `;
    const result = await client.query(query, [sinceIso, agentId, userId]);
    return new Set(
      result.rows
        .map((row) => row.external_conversation_id)
        .filter((value) => typeof value === "string" && value.length > 0),
    );
  } finally {
    await client.end();
  }
}

export async function fetchExternal(apiUrl, apiKey, requestPath) {
  const response = await fetch(`${apiUrl}${requestPath}`, {
    headers: { "X-API-Key": apiKey },
  });
  const json = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    payload: unwrapPayload(json),
    raw: json,
  };
}

export async function loadAgents(supabase, filters = {}) {
  let query = supabase
    .from("chat_bot_agents")
    .select(
      "user_id, external_agent_id, provisioning_status, billing_exempt, user_profiles(first_name,last_name,email)",
    )
    .eq("provisioning_status", "active");

  if (filters.agentId) {
    query = query.eq("external_agent_id", filters.agentId);
  }

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load active chat bot agents: ${error.message}`);
  }

  return data ?? [];
}

export async function findConversationByLeadId(apiUrl, apiKey, agents, leadId) {
  for (const agent of agents) {
    for (let page = 1; page <= 50; page += 1) {
      const response = await fetchExternal(
        apiUrl,
        apiKey,
        `/api/external/agents/${agent.external_agent_id}/conversations?page=${page}&limit=100`,
      );

      if (!response.ok) {
        throw new Error(
          `Failed to scan conversations for agent ${agent.external_agent_id}: ${response.status}`,
        );
      }

      const conversations = Array.isArray(response.payload)
        ? response.payload
        : [];
      const match = conversations.find(
        (conversation) => conversation.closeLeadId === leadId,
      );

      if (match) {
        return { agent, conversation: match };
      }

      const pagination = response.raw?.meta?.pagination ?? {};
      if (!pagination.hasNext || conversations.length === 0) {
        break;
      }
    }
  }

  return null;
}

export async function findConversationByConversationId(
  apiUrl,
  apiKey,
  agents,
  conversationId,
) {
  for (const agent of agents) {
    for (let page = 1; page <= 50; page += 1) {
      const response = await fetchExternal(
        apiUrl,
        apiKey,
        `/api/external/agents/${agent.external_agent_id}/conversations?page=${page}&limit=100`,
      );

      if (!response.ok) {
        throw new Error(
          `Failed to scan conversations for agent ${agent.external_agent_id}: ${response.status}`,
        );
      }

      const conversations = Array.isArray(response.payload)
        ? response.payload
        : [];
      const match = conversations.find(
        (conversation) => conversation.id === conversationId,
      );

      if (match) {
        return { agent, conversation: match };
      }

      const pagination = response.raw?.meta?.pagination ?? {};
      if (!pagination.hasNext || conversations.length === 0) {
        break;
      }
    }
  }

  return null;
}

export async function findConversationByLeadSearch(apiUrl, apiKey, agents, target) {
  const params = new URLSearchParams();
  if (target.leadName) params.set("leadName", target.leadName);
  if (target.leadPhone) params.set("leadPhone", target.leadPhone);
  params.set("from", target.from ?? "2025-01-01");

  for (const agent of agents) {
    const response = await fetchExternal(
      apiUrl,
      apiKey,
      `/api/external/agents/${agent.external_agent_id}/conversations/search?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to search conversations for agent ${agent.external_agent_id}: ${response.status}`,
      );
    }

    const matches = Array.isArray(response.payload) ? response.payload : [];
    if (matches.length > 0) {
      const selected = matches[0];
      return {
        agent,
        conversation: {
          id: selected.id,
          closeLeadId: selected.closeLeadId ?? null,
          leadName: selected.leadName ?? null,
          leadPhone: selected.leadPhone ?? null,
          status: null,
          createdAt: selected.startedAt ?? null,
          updatedAt: selected.startedAt ?? null,
        },
      };
    }
  }

  return null;
}

export async function resolveTargetConversation(apiUrl, apiKey, agents, target) {
  if (target.leadId) {
    return findConversationByLeadId(apiUrl, apiKey, agents, target.leadId);
  }

  if (target.conversationId) {
    return findConversationByConversationId(
      apiUrl,
      apiKey,
      agents,
      target.conversationId,
    );
  }

  return findConversationByLeadSearch(apiUrl, apiKey, agents, target);
}

export async function loadAgentBundle(apiUrl, apiKey, agentId, conversationId) {
  const [agent, status, monitoring, messages, appointments] = await Promise.all([
    fetchExternal(apiUrl, apiKey, `/api/external/agents/${agentId}`),
    fetchExternal(apiUrl, apiKey, `/api/external/agents/${agentId}/status`),
    fetchExternal(apiUrl, apiKey, `/api/external/agents/${agentId}/monitoring`),
    conversationId
      ? fetchExternal(
          apiUrl,
          apiKey,
          `/api/external/agents/${agentId}/conversations/${conversationId}/messages?page=1&limit=100`,
        )
      : Promise.resolve({ ok: true, payload: [] }),
    fetchExternal(apiUrl, apiKey, `/api/external/agents/${agentId}/appointments?page=1&limit=100`),
  ]);

  return {
    agent: agent.payload,
    status: status.payload,
    monitoring: monitoring.payload,
    messages: Array.isArray(messages.payload) ? messages.payload : [],
    appointments: Array.isArray(appointments.payload) ? appointments.payload : [],
  };
}

export function buildReview({ target, agent, conversation, bundle }) {
  return analyzeChatBotLeadReview({
    target: {
      ...target,
      selectedAgentId: agent.external_agent_id,
      selectedUserId: agent.user_id,
      selectedAgentProfile: agent.user_profiles ?? null,
    },
    agentBundle: bundle,
    conversation,
    messages: bundle.messages,
  });
}

export async function saveReview({
  supabase,
  env = {},
  review,
  mode,
  promptVersion = null,
  humanVerdict = null,
  resolutionStatus = "open",
}) {
  const improvementBrief = buildChatBotImprovementBrief(review);
  const payload = {
    user_id: review.target.selectedUserId,
    external_agent_id: review.target.selectedAgentId,
    external_conversation_id: review.conversation?.id ?? null,
    close_lead_id: review.target.leadId ?? review.conversation?.closeLeadId ?? null,
    review_mode: mode,
    primary_reason_code: review.summary.primaryReasonCode,
    primary_reason: review.summary.primaryReason,
    found_conversation: review.summary.foundConversation,
    conversation_status: review.summary.conversationStatus,
    outbound_count: review.summary.outboundCount,
    inbound_count: review.summary.inboundCount,
    prompt_version: promptVersion,
    human_verdict: humanVerdict,
    resolution_status: resolutionStatus,
    target_payload: review.target,
    findings: review.findings,
    timeline: review.timeline,
    gaps: review.gaps,
    improvement_brief: improvementBrief,
    agent_snapshot: review.agentSnapshot,
    conversation_snapshot: review.conversation,
    review_payload: review,
  };

  const { data, error } = await supabase
    .from("chat_bot_conversation_reviews")
    .insert(payload)
    .select("id, created_at, primary_reason_code, external_conversation_id")
    .single();

  if (error) {
    if (error.message?.includes("schema cache")) {
      return insertReviewViaPostgres(
        env.REMOTE_DATABASE_URL || env.DATABASE_URL,
        payload,
      );
    }
    throw new Error(`Failed to save review: ${error.message}`);
  }

  return data;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getConversationActivityTimestamp(conversation) {
  return (
    parseDate(conversation.updatedAt) ??
    parseDate(conversation.lastEventAt) ??
    parseDate(conversation.createdAt)
  );
}

export async function listRecentAgentConversations(
  apiUrl,
  apiKey,
  { agentId, sinceIso = null, limit = 200, maxPages = 50 },
) {
  const results = [];
  const seenIds = new Set();
  const sinceDate = sinceIso ? parseDate(sinceIso) : null;

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchExternal(
      apiUrl,
      apiKey,
      `/api/external/agents/${agentId}/conversations?page=${page}&limit=100`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to list conversations for agent ${agentId}: ${response.status}`,
      );
    }

    const conversations = Array.isArray(response.payload) ? response.payload : [];
    let pageHasRecentConversation = false;

    for (const conversation of conversations) {
      if (seenIds.has(conversation.id)) continue;
      seenIds.add(conversation.id);

      const activityAt = getConversationActivityTimestamp(conversation);
      if (sinceDate && activityAt && activityAt.getTime() < sinceDate.getTime()) {
        continue;
      }

      if (sinceDate && activityAt) {
        pageHasRecentConversation = true;
      }

      results.push(conversation);
      if (results.length >= limit) {
        return results;
      }
    }

    const pagination = response.raw?.meta?.pagination ?? {};
    if (!pagination.hasNext || conversations.length === 0) {
      break;
    }

    if (sinceDate && !pageHasRecentConversation) {
      break;
    }
  }

  return results;
}

export function parseHoursAgo(value, fallbackHours) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return new Date(Date.now() - fallbackHours * 60 * 60 * 1000).toISOString();
  }

  return new Date(Date.now() - numeric * 60 * 60 * 1000).toISOString();
}

export async function loadExistingReviewedConversationIds(
  supabase,
  env = {},
  { sinceIso, agentId = null, userId = null },
) {
  let query = supabase
    .from("chat_bot_conversation_reviews")
    .select("external_conversation_id")
    .not("external_conversation_id", "is", null)
    .gte("created_at", sinceIso);

  if (agentId) {
    query = query.eq("external_agent_id", agentId);
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message?.includes("schema cache")) {
      return loadReviewedConversationIdsViaPostgres(
        env.REMOTE_DATABASE_URL || env.DATABASE_URL,
        { sinceIso, agentId, userId },
      );
    }
    throw new Error(
      `Failed to load existing conversation reviews for dedupe: ${error.message}`,
    );
  }

  return new Set(
    (data ?? [])
      .map((row) => row.external_conversation_id)
      .filter((value) => typeof value === "string" && value.length > 0),
  );
}
