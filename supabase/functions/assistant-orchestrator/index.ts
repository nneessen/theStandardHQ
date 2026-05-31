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
import { createSupabaseClient } from "../_shared/supabase-client.ts";
import { corsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { getAnthropicClient, ORCHESTRATOR_MODEL } from "./anthropic.ts";
import { ALL_AGENT_KEYS, buildSystemPrompt, getAgent } from "./core/agents.ts";
import { canAccessAssistant } from "./core/access.ts";
import { routeToAgent } from "./core/routing.ts";
import { canUseTool } from "./core/guard.ts";
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

    // Profile: super-admin flag (for the guard) + first name (for the greeting).
    const { data: profile } = await db
      .from("user_profiles")
      .select("is_super_admin, first_name")
      .eq("id", user.id)
      .single();
    const isSuperAdmin = profile?.is_super_admin === true;
    const firstName: string | null = profile?.first_name ?? null;

    // Command center is limited to Epic Life (super-admins bypass). Fail fast,
    // before any Anthropic spend. Mirrors the frontend RouteGuard gate.
    if (!canAccessAssistant({ email: user.email, isSuperAdmin })) {
      return json(
        { error: "The command center isn't available for your account." },
        403,
      );
    }

    // Effective IMO (best-effort; inherits the app's current scoping).
    let imoId: string | null = null;
    const { data: imoData } = await db.rpc("get_my_imo_id");
    if (typeof imoData === "string") imoId = imoData;

    // Preferences (defaults if the user has none yet).
    const { data: prefs } = await db
      .from("assistant_preferences")
      .select("assistant_name, enabled_agents")
      .eq("user_id", user.id)
      .single();
    const assistantName: string = prefs?.assistant_name ?? "Jarvis";
    const enabledAgents =
      (prefs?.enabled_agents as AgentKey[] | undefined) ?? ALL_AGENT_KEYS;

    const agentKey = routeToAgent(message, enabledAgents);
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

    const systemPrompt = buildSystemPrompt(agent, assistantName);
    const tools = buildAnthropicTools(agent.allowedToolNames);
    const anthropic = getAnthropicClient();

    // deno-lint-ignore no-explicit-any
    const messages: any[] = [...history, { role: "user", content: message }];
    // deno-lint-ignore no-explicit-any
    const toolCallRows: any[] = [];
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
              model: ORCHESTRATOR_MODEL,
              max_tokens: MAX_TOKENS_PER_TURN,
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

            // deno-lint-ignore no-explicit-any
            const toolResults: any[] = [];
            for (const tu of toolUses) {
              const meta = TOOL_METADATA[tu.name];
              const tool = TOOLS[tu.name];
              const decision = canUseTool(meta, [], { isSuperAdmin });
              const t0 = Date.now();
              let output: unknown;
              let status = "success";
              let errorMsg: string | null = null;

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
                    createdActions.push({
                      actionRequestId: o.actionRequestId,
                      channel: String(o.channel ?? ""),
                    });
                  }
                } catch (e) {
                  status = "error";
                  errorMsg = e instanceof Error ? e.message : "tool_failed";
                  output = { error: "The tool failed to run." };
                }
              }

              toolActivity.push({ name: tu.name, status });
              send("tool", { name: tu.name, status });
              groundingOutputs.push(output);
              toolCallRows.push({
                conversation_id: conversationId,
                user_id: user.id,
                tool_name: tu.name,
                category: meta?.category ?? null,
                risk_level: meta?.riskLevel ?? null,
                input_redacted: redact(tu.input ?? {}),
                // Summarize (counts + available flags + structure), never raw row
                // values — keeps names, premiums, DOB out of the audit log.
                output_redacted: summarizeToolOutput(output),
                status,
                error: errorMsg,
                duration_ms: Date.now() - t0,
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(output),
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
