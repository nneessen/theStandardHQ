// assistant-orchestrator — the Jarvis command-center brain.
//
// Flow: authenticate the caller (user-scoped client => RLS as the user), load prefs +
// route to an agent, then run a capped Anthropic tool-use loop. Every tool call passes
// through the permission guard and runs on the user-scoped client (so all data access
// is RLS-scoped). Conversation, final message, and redacted tool calls are persisted.
//
// Safety: the model can only call read/draft tools. Draft tools create pending action
// rows; nothing is sent here. External sends happen only in assistant-action-execute
// after explicit human approval.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseClient,
  createSupabaseAdminClient,
} from "../_shared/supabase-client.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { enforceRateLimit, checkRateLimit } from "../_shared/rate-limit.ts";
import { getAnthropicClient, ORCHESTRATOR_MODEL } from "./anthropic.ts";
import { ALL_AGENT_KEYS, buildSystemPrompt, getAgent } from "./core/agents.ts";
import { canAccessAssistant } from "./core/access.ts";
import { routeToAgent } from "./core/routing.ts";
import { canUseTool, effectiveActionClass } from "./core/guard.ts";
import { requestRateBucket } from "./core/rateBucket.ts";
import { TOOL_METADATA } from "./core/registry.ts";
import { redact, summarizeToolOutput } from "./core/redaction.ts";
import { assessGrounding } from "./core/grounding.ts";
import type { AgentKey } from "./core/types.ts";
import { buildAnthropicTools, TOOLS } from "./tools/index.ts";
import type { AssistantToolContext } from "./tools/types.ts";
import { createCloseProvider } from "./close/provider.ts";
import { createUnderwritingRunner } from "./tools/underwritingRunner.ts";

const MAX_TOOL_ITERATIONS = 10;
const WALL_TIME_MS = 25_000;
const TOKEN_BUDGET = 80_000;
const MAX_TOKENS_PER_TURN = 2000;

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Keep-warm ping: returns immediately, before any auth/DB/Anthropic work. Its
  // only job is to boot a cold isolate (which loads this module — including the
  // heavy Anthropic SDK import — into memory) so the next real turn skips the
  // cold-start tax. The command center pings this on mount + on an interval while
  // open. Signalled via a `?warm=1` query param (not a custom header) so it rides
  // the existing CORS allow-list — a custom request header would be blocked by the
  // browser preflight. No data crosses; nothing is exposed.
  if (new URL(req.url).searchParams.get("warm") === "1")
    return json({ ok: true, warm: true });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader)
      return json({ error: "Missing Authorization header" }, 401);

    const db = createSupabaseClient(authHeader);
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return json({ error: "message is required" }, 400);
    let conversationId: string | null =
      typeof body.conversationId === "string" ? body.conversationId : null;

    // Pre-flight fan-out: these five calls depend only on the verified user.id,
    // are independent of one another, and none spends Anthropic tokens or mutates
    // app state — so run them CONCURRENTLY (was ~5 serial round-trips). The gates
    // they feed are still evaluated strictly IN ORDER below, before any routing,
    // conversation INSERT, or model spend. Promise.all preserves today's behavior:
    // a query-level error resolves to data:null (→ defaults via `??`), while a true
    // network rejection propagates to the outer catch → 500 (same as the old serial
    // awaits). Minor change: an access-denied user's rate-limit counters increment
    // once before the 403 — harmless (per-user; still 403'd).
    //   Rate buckets: Request = 30/hr typed · 600/hr voice (its OWN bucket — a spoken
    //   session runs 10+ turns/min and would trip the 30/hr cap mid-conversation); Token =
    //   200k/day shared across Anthropic functions (checked here at 0 tokens to reject if
    //   already over) — the token axis stays the real cost ceiling for BOTH surfaces.
    // The realtime voice worker tags its turns with `x-jarvis-surface: voice`. This header
    // only selects the caller's OWN per-user request bucket (not a tenant boundary), so a
    // spoofed value at most inflates that one user's request allowance — still token-bounded.
    // Note: it is deliberately NOT in `_shared/cors.ts` Access-Control-Allow-Headers, so a
    // BROWSER cannot send it (preflight blocks it) — only the server-side worker does. Do not
    // add it to the CORS allow-list (that would let any tab self-grant the higher bucket).
    const isVoiceSurface = req.headers.get("x-jarvis-surface") === "voice";
    const adminClient = createSupabaseAdminClient();
    const reqBucket = requestRateBucket(user.id, isVoiceSurface);
    const tokBucketKey = `ratelimit:tok:${user.id}`;

    const [profileRes, reqLimit, tokLimit, imoRes, prefsRes] =
      await Promise.all([
        db
          .from("user_profiles")
          .select("is_super_admin, first_name")
          .eq("id", user.id)
          .single(),
        enforceRateLimit(
          adminClient,
          {
            key: reqBucket.key,
            maxRequests: reqBucket.maxRequests,
            windowSeconds: 3600,
          },
          cors,
        ),
        enforceRateLimit(
          adminClient,
          {
            key: tokBucketKey,
            maxRequests: 2_000_000_000,
            windowSeconds: 86400,
            tokens: 0,
            maxTokens: 200_000,
          },
          cors,
        ),
        db.rpc("get_my_imo_id"),
        db
          .from("assistant_preferences")
          .select("assistant_name, enabled_agents")
          .eq("user_id", user.id)
          .single(),
      ]);

    // Profile: super-admin flag (for the guard) + first name (for the greeting).
    const profile = profileRes.data;
    const isSuperAdmin = profile?.is_super_admin === true;
    const firstName: string | null = profile?.first_name ?? null;

    // GATE 1 — access. Command center is limited to Epic Life (super-admins
    // bypass). Fail fast, before any Anthropic spend. Mirrors the frontend guard.
    if (!canAccessAssistant({ email: user.email, isSuperAdmin })) {
      return json(
        { error: "The command center isn't available for your account." },
        403,
      );
    }
    // GATE 2 + 3 — rate limits (request bucket, then daily token budget). Both were
    // resolved above; return the 429 here, still before routing/insert/spend.
    if (reqLimit) return reqLimit;
    if (tokLimit) return tokLimit;

    // Effective IMO (best-effort; inherits the app's current scoping).
    let imoId: string | null = null;
    const imoData = imoRes.data;
    if (typeof imoData === "string") imoId = imoData;

    // Preferences (defaults if the user has none yet).
    const prefs = prefsRes.data;
    const assistantName: string = prefs?.assistant_name ?? "Jarvis";
    const enabledAgents =
      (prefs?.enabled_agents as AgentKey[] | undefined) ?? ALL_AGENT_KEYS;

    // Agent continuity: a follow-up with no clear intent ("yes", "ok") should stay
    // with the specialist that handled the prior turn rather than snapping back to the
    // default (which would strip away that specialist's tools/context). Look up the
    // last assistant turn's agent for this conversation (RLS-scoped; null/ignored if
    // none or not owned).
    let previousAgent: AgentKey | null = null;
    if (conversationId) {
      const { data: lastMsg } = await db
        .from("assistant_messages")
        .select("agent_key")
        .eq("conversation_id", conversationId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }) // deterministic tiebreak on equal timestamps
        .limit(1)
        .maybeSingle();
      const prev = (lastMsg as { agent_key?: string } | null)?.agent_key;
      previousAgent = (prev as AgentKey | undefined) ?? null;
    }

    const agentKey = routeToAgent(message, enabledAgents, previousAgent);
    const agent = getAgent(agentKey);

    // Reuse the conversation if it exists and is owned (RLS); otherwise create one.
    if (conversationId) {
      const { data: existing } = await db
        .from("assistant_conversations")
        .select("id")
        .eq("id", conversationId)
        .maybeSingle();
      if (!existing) conversationId = null;
    }
    if (!conversationId) {
      const { data: convo, error: convoErr } = await db
        .from("assistant_conversations")
        .insert({
          user_id: user.id,
          imo_id: imoId,
          agent_key: agentKey,
          title: message.slice(0, 80),
        })
        .select("id")
        .single();
      if (convoErr || !convo)
        return json({ error: "Could not start conversation" }, 500);
      conversationId = convo.id;
    }

    // Prior text turns for continuity (tool internals are not replayed cross-request).
    const { data: priorRows } = await db
      .from("assistant_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(20);
    const history = (priorRows ?? []).map((r) => ({
      role: r.role === "assistant" ? "assistant" : "user",
      content: r.content,
    }));

    // Guaranteed non-null here: we either reused a valid conversation or created one
    // (returning early on insert error).
    const convId = conversationId as string;
    const ctx: AssistantToolContext = {
      db: db as unknown as AssistantToolContext["db"],
      userId: user.id,
      imoId,
      conversationId: convId,
      firstName,
      // Lazy: only resolves (service-role fetch + decrypt) if a Close tool runs.
      close: createCloseProvider(user.id),
      // Authoritative engine bound to the user's RLS-scoped client. Keeps the heavy
      // engine import out of the offline-tested tools/ layer (mirrors close).
      underwriting: createUnderwritingRunner(db),
    };

    // Ground the model in the REAL current date (in the business timezone) so it
    // resolves "yesterday" / "this month" / "MTD" correctly and passes the right
    // YYYY-MM-DD ranges to tools — instead of inventing a date (it once reported
    // "July 13" for "yesterday"). Edge isolates run in UTC, so compute the date in
    // ASSISTANT_TIMEZONE (default US Eastern, the business TZ) via Intl.
    const tz = Deno.env.get("ASSISTANT_TIMEZONE") ?? "America/New_York";
    const nowDate = new Date();
    const nowLong = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(nowDate);
    // en-CA renders YYYY-MM-DD; the timeZone option pins it to the business day.
    const nowIso = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(
      nowDate,
    );
    const nowContext = `CURRENT DATE: Today is ${nowLong} (${nowIso}, ${tz}). Resolve every relative date from this and pass explicit YYYY-MM-DD ranges to date-scoped tools. Never invent or assume a date.`;

    const systemPrompt = buildSystemPrompt(agent, assistantName, nowContext);
    const tools = buildAnthropicTools(agent.allowedToolNames);
    const anthropic = getAnthropicClient();

    // Cross-turn prompt caching: mark the LAST prior-history message as a cache
    // breakpoint so tools + system + the history prefix are read from cache on
    // iterations 2+ and on follow-up turns within the 5-min TTL. The fresh user
    // message stays AFTER the breakpoint so it never invalidates the cached prefix.
    // This is the 3rd of Anthropic's 4 allowed breakpoints (system + last tool are
    // the other two). No breakpoint is added on the first turn (empty history).
    // deno-lint-ignore no-explicit-any
    const messages: any[] = [
      ...history.map((m, i) =>
        i === history.length - 1
          ? {
              role: m.role,
              content: [
                {
                  type: "text",
                  text: m.content,
                  cache_control: { type: "ephemeral" },
                },
              ],
            }
          : m,
      ),
      { role: "user", content: message },
    ];
    // deno-lint-ignore no-explicit-any
    const toolCallRows: any[] = [];
    // Append-only governance audit args (written via log_assistant_audit in persist()).
    // deno-lint-ignore no-explicit-any
    const auditRows: any[] = [];
    const toolActivity: Array<{ name: string; status: string }> = [];
    // Tool outputs this turn, for the H2 no-fabrication backstop (see core/grounding.ts).
    const groundingOutputs: unknown[] = [];
    const createdActions: Array<{ actionRequestId: string; channel: string }> =
      [];
    let finalText = "";
    let tokensUsed = 0;
    const startedAt = Date.now();

    // Stream the turn over Server-Sent Events: `delta` (text as it generates),
    // `tool` (chip activity), `done` (metadata: ids, actionRequests, grounding),
    // `error`. The model keeps generating server-side even if the client leaves;
    // writes are guarded so a disconnect can't abort the loop, and persistence
    // runs via EdgeRuntime.waitUntil so it completes after the stream closes.
    const encoder = new TextEncoder();
    let clientGone = false;

    const sse = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          if (clientGone) return;
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
          } catch {
            // Client disconnected — stop writing, keep generating + persisting.
            clientGone = true;
          }
        };

        try {
          for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            if (Date.now() - startedAt > WALL_TIME_MS) break;
            if (tokensUsed > TOKEN_BUDGET) break;

            // Prompt caching: cache_control breakpoints on the static prefix
            // (tools + system) so iterations 2+ — which re-send the identical
            // prefix with a longer messages tail — read it from cache (~0.1x).
            // Render order is tools -> system -> messages, so the marker on the
            // LAST tool covers the tools block and the marker on system covers
            // tools+system. Sub-minimum prefixes (Sonnet 4.6 = 2048 tok) just
            // won't cache, no error.
            // deno-lint-ignore no-explicit-any
            const params: any = {
              // Per-agent overrides (faster model + tighter cap for draft agents);
              // fall back to the orchestrator defaults when an agent sets neither.
              model: agent.model ?? ORCHESTRATOR_MODEL,
              max_tokens: agent.maxTokens ?? MAX_TOKENS_PER_TURN,
              system: [
                {
                  type: "text",
                  text: systemPrompt,
                  cache_control: { type: "ephemeral" },
                },
              ],
              messages,
            };
            if (tools.length > 0) {
              params.tools = tools.map((t, idx) =>
                idx === tools.length - 1
                  ? { ...t, cache_control: { type: "ephemeral" } }
                  : t,
              );
            }

            // Stream this turn's text deltas live. finalMessage() then returns the
            // identical {content, stop_reason, usage} that messages.create did, so
            // the tool dispatch + budget accounting below are byte-for-byte the same.
            const turn = anthropic.messages.stream(params);
            let firstDeltaThisIter = true;
            for await (const ev of turn) {
              if (
                ev.type === "content_block_delta" &&
                ev.delta?.type === "text_delta"
              ) {
                let text = ev.delta.text as string;
                // A tool preamble turn and the next turn's text are separate
                // assistant turns with no joining whitespace — insert a break so
                // they don't run together in the rendered/spoken reply.
                if (firstDeltaThisIter && finalText && !/\s$/.test(finalText)) {
                  text = `\n\n${text}`;
                }
                firstDeltaThisIter = false;
                finalText += text;
                send("delta", { text });
              }
            }
            const resp = await turn.finalMessage();

            // Count cache_creation + cache_read too: after caching,
            // usage.input_tokens is the UNCACHED remainder only, so summing just
            // input+output would undercount and let the budget guard fire late.
            tokensUsed +=
              (resp.usage?.input_tokens ?? 0) +
              (resp.usage?.cache_creation_input_tokens ?? 0) +
              (resp.usage?.cache_read_input_tokens ?? 0) +
              (resp.usage?.output_tokens ?? 0);
            messages.push({ role: "assistant", content: resp.content });

            // deno-lint-ignore no-explicit-any
            const toolUses = (resp.content as any[]).filter(
              (b) => b.type === "tool_use",
            );
            if (resp.stop_reason !== "tool_use" || toolUses.length === 0) break;

            // Execute the model's tool calls for THIS response CONCURRENTLY. Each
            // task computes its own result and returns a record — it pushes to NO
            // shared array, so there's no interleaving nondeterminism. After the
            // batch settles we replay the records in the original toolUses order to
            // emit chip events and append audit rows / grounding outputs / created
            // actions / tool_result blocks — keeping all of that order-identical to
            // the old serial loop while the actual tool .run() calls overlap.
            // Per-tool duration_ms is measured inside each task (real concurrent
            // timing). Each task is self-contained try/caught, so one tool failing
            // never rejects the batch.
            const settled = await Promise.all(
              // deno-lint-ignore no-explicit-any
              toolUses.map(async (tu: any) => {
                const meta = TOOL_METADATA[tu.name];
                const tool = TOOLS[tu.name];
                // NOTE (kernel wiring, Phase 1/2): userPermissions is still [] and
                // connectedProviders/hasApproval are not threaded here yet. That is fine for
                // every CURRENT tool (all read/draft, empty requiredPermissions, no
                // requiredConnection). But the FIRST tool that sets requiredPermissions (e.g.
                // webSearch) or requiredConnection (e.g. Discord) will be denied for everyone
                // until this call passes the user's real permissions + linked providers. Wire
                // those before registering any permissioned/connection-gated tool. Privileged
                // actionClasses correctly stay denied in the model loop (they run out-of-band
                // via assistant-action-execute after human approval, never invoked directly).
                const decision = canUseTool(meta, [], { isSuperAdmin });
                const t0 = Date.now();
                let output: unknown;
                let status = "success";
                let errorMsg: string | null = null;
                let createdAction: {
                  actionRequestId: string;
                  channel: string;
                } | null = null;

                if (!decision.allowed || !tool) {
                  status = "denied";
                  errorMsg = decision.reason ?? "unknown_tool";
                  output = { error: `Tool not permitted: ${errorMsg}` };
                } else {
                  try {
                    output = await tool.run(
                      (tu.input ?? {}) as Record<string, unknown>,
                      ctx,
                    );
                    const o = output as Record<string, unknown> | null;
                    if (
                      o &&
                      o.ok === true &&
                      typeof o.actionRequestId === "string"
                    ) {
                      createdAction = {
                        actionRequestId: o.actionRequestId,
                        channel: String(o.channel ?? ""),
                      };
                    }
                  } catch (e) {
                    status = "error";
                    errorMsg = e instanceof Error ? e.message : "tool_failed";
                    output = { error: "The tool failed to run." };
                  }
                }

                return {
                  tu,
                  meta,
                  output,
                  status,
                  errorMsg,
                  createdAction,
                  durationMs: Date.now() - t0,
                };
              }),
            );

            // deno-lint-ignore no-explicit-any
            const toolResults: any[] = [];
            for (const r of settled) {
              if (r.createdAction) createdActions.push(r.createdAction);
              toolActivity.push({ name: r.tu.name, status: r.status });
              send("tool", { name: r.tu.name, status: r.status });
              groundingOutputs.push(r.output);
              toolCallRows.push({
                conversation_id: conversationId,
                user_id: user.id,
                tool_name: r.tu.name,
                category: r.meta?.category ?? null,
                risk_level: r.meta?.riskLevel ?? null,
                input_redacted: redact(r.tu.input ?? {}),
                // Summarize (counts + available flags + structure), never raw row
                // values — keeps names, premiums, DOB out of the audit log.
                output_redacted: summarizeToolOutput(r.output),
                status: r.status,
                error: r.errorMsg,
                duration_ms: r.durationMs,
              });
              auditRows.push({
                p_surface: isVoiceSurface ? "voice" : "text",
                p_event: r.status === "denied" ? "tool_denied" : "tool_call",
                p_tool_name: r.tu.name,
                p_action_class: r.meta ? effectiveActionClass(r.meta) : null,
                p_decision: r.status, // success | denied | error
                p_decision_reason: r.errorMsg ?? null,
                p_action_request_id: r.createdAction?.actionRequestId ?? null,
                p_imo_id: imoId,
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: r.tu.id,
                content: JSON.stringify(r.output),
              });
            }
            messages.push({ role: "user", content: toolResults });
          }

          if (!finalText) {
            finalText =
              "I couldn't finish that within the allowed steps. Try a more specific request.";
            send("delta", { text: finalText });
          }

          // H2 no-fabrication backstop: flag a reply that states figures when
          // every tool section came back unavailable. Heuristic — annotates
          // (logged + returned), never blocks. The cross-turn (L2) check flags
          // follow-up turns that state figures without running any tool.
          const grounding = assessGrounding(groundingOutputs, finalText, {
            hasPriorTurns: history.length > 0,
          });
          if (grounding.ungroundedNumericWarning) {
            console.warn(
              `assistant-orchestrator: possible ungrounded numerics (conversation=${conversationId}, agent=${agentKey}) — reply states figures but every tool section was unavailable.`,
            );
          }
          if (grounding.crossTurnFigureWarning) {
            console.warn(
              `assistant-orchestrator: possible cross-turn ungrounded numerics (conversation=${conversationId}, agent=${agentKey}) — follow-up reply states figures but ran no grounding tool this turn.`,
            );
          }

          send("done", {
            conversationId,
            agentKey,
            actionRequests: createdActions,
            grounding,
            toolActivity,
          });
        } catch (e) {
          console.error("assistant-orchestrator stream error", e);
          send("error", { error: "Assistant failed to respond." });
        } finally {
          try {
            controller.close();
          } catch {
            /* already closed */
          }

          // Persist turns + tool audit + recency bump. Reached even on a
          // mid-stream disconnect (the writes above are guarded and never throw
          // out of the loop). waitUntil keeps the isolate alive until it lands.
          const persist = (async () => {
            // Record actual tokens spent this turn against the daily token bucket.
            // Ignored if the limiter RPC errors (fail-open); the result's `allowed`
            // field is intentionally not checked — we don't block a turn that
            // already ran, only the NEXT one if the budget is exhausted.
            if (tokensUsed > 0) {
              await checkRateLimit(adminClient, {
                key: tokBucketKey,
                maxRequests: 2_000_000_000,
                windowSeconds: 86400,
                tokens: tokensUsed,
                maxTokens: 200_000,
              });
            }

            await db.from("assistant_messages").insert([
              {
                conversation_id: conversationId,
                user_id: user.id,
                role: "user",
                content: message,
                agent_key: agentKey,
              },
              {
                conversation_id: conversationId,
                user_id: user.id,
                role: "assistant",
                content: finalText,
                agent_key: agentKey,
              },
            ]);
            if (toolCallRows.length > 0) {
              await db.from("assistant_tool_calls").insert(toolCallRows);
            }
            // Append-only governance audit. Runs here in persist() (waitUntil) so it adds
            // ZERO user-facing latency, and best-effort (an audit failure must never break a
            // turn). log_assistant_audit is SECURITY DEFINER and stamps actor := auth.uid()
            // from this user-scoped `db` client, so the trail can't be forged.
            if (auditRows.length > 0) {
              await Promise.all(
                auditRows.map(async (a) => {
                  try {
                    await db.rpc("log_assistant_audit", a);
                  } catch {
                    /* best-effort: never break a turn on an audit-write failure */
                  }
                }),
              );
            }
            await db
              .from("assistant_conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", conversationId);
          })().catch((err) =>
            console.error("assistant-orchestrator persist error", err),
          );
          // deno-lint-ignore no-explicit-any
          (globalThis as any).EdgeRuntime?.waitUntil(persist);
        }
      },
    });

    return new Response(sse, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("assistant-orchestrator error", e);
    return json({ error: "Assistant failed to respond." }, 500);
  }
});
