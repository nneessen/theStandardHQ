// supabase/functions/generate-recruiting-design/index.ts
//
// Generates a validated recruiting-page design spec from an agent's prompt
// (+ optional reference screenshots, + optional current spec for refinement).
// The AI returns JSON only; the server re-validates/repairs it before returning.
// The CLIENT re-validates again at render — this function is a quality gate, not
// the security boundary. JWT-verified (deploy WITHOUT --no-verify-jwt).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { enforceAiRateLimits, recordAiTokens } from "../_shared/rate-limit.ts";
import {
  getAnthropicClient,
  MODEL_SMART,
  extractText,
  parseJsonFromText,
} from "../close-ai-builder/ai/anthropic-client.ts";
import { validateDesignSpec, isUsableSpec } from "./spec-validator.ts";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type AgentContext,
  type ConversationTurn,
} from "./system-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const MAX_PROMPT = 4000;
const MAX_CONVERSATION_TURNS = 20;
const MAX_IMAGES = 4;
const MAX_IMAGE_B64_CHARS = 7_000_000; // ~5MB raw per image
const ALLOWED_MEDIA = ["image/png", "image/jpeg", "image/webp", "image/gif"];

interface ReferenceImage {
  media_type: string;
  data: string;
}

interface GenerateRequest {
  prompt?: string;
  conversation?: ConversationTurn[];
  currentSpec?: unknown;
  referenceImages?: ReferenceImage[];
  agentContext?: Partial<AgentContext>;
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: jsonHeaders,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      return errorResponse("ANTHROPIC_API_KEY not configured", 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Auth: confirm user + approved status + IMO.
    const { data: userData, error: userError } =
      await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return errorResponse("Unauthorized: invalid session", 401);
    }

    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("id, imo_id, approval_status")
      .eq("id", userData.user.id)
      .single();
    if (profileError || !profile?.imo_id) {
      return errorResponse("Unauthorized: user has no IMO assigned", 403);
    }
    if (profile.approval_status !== "approved") {
      return errorResponse("Unauthorized: account not approved", 403);
    }
    const userId = profile.id as string;

    // Rate limiting — before any Anthropic spend.
    const limited = await enforceAiRateLimits(
      admin,
      "generate-recruiting-design",
      userId,
      jsonHeaders,
    );
    if (limited) return limited;

    // Parse + validate input.
    const body = (await req.json()) as GenerateRequest;
    const prompt = (body.prompt ?? "").trim();
    if (!prompt) return errorResponse("A design prompt is required.", 400);
    if (prompt.length > MAX_PROMPT) {
      return errorResponse(`Prompt too long (max ${MAX_PROMPT} chars).`, 400);
    }

    const conversation = Array.isArray(body.conversation)
      ? body.conversation.slice(-MAX_CONVERSATION_TURNS)
      : [];

    const images = Array.isArray(body.referenceImages)
      ? body.referenceImages
      : [];
    if (images.length > MAX_IMAGES) {
      return errorResponse(`Too many images (max ${MAX_IMAGES}).`, 400);
    }
    for (const img of images) {
      if (
        !img ||
        typeof img.data !== "string" ||
        typeof img.media_type !== "string"
      ) {
        return errorResponse("Malformed reference image.", 400);
      }
      if (!ALLOWED_MEDIA.includes(img.media_type)) {
        return errorResponse(`Unsupported image type: ${img.media_type}`, 400);
      }
      if (img.data.length > MAX_IMAGE_B64_CHARS) {
        return errorResponse("An image is too large (max ~5MB).", 400);
      }
    }

    // Re-validate any client-supplied current spec before refining it.
    const currentSpec = body.currentSpec
      ? validateDesignSpec(body.currentSpec).spec
      : undefined;

    const agentContext: AgentContext = {
      primary_color: body.agentContext?.primary_color || "#0ea5e9",
      accent_color: body.agentContext?.accent_color || "#22c55e",
      display_name: body.agentContext?.display_name ?? null,
      headline: body.agentContext?.headline ?? null,
      subheadline: body.agentContext?.subheadline ?? null,
      calendly_url: body.agentContext?.calendly_url ?? null,
    };

    const system = buildSystemPrompt(agentContext);
    const userText = buildUserPrompt({ prompt, conversation, currentSpec });

    // Vision blocks first (if any), then the text instruction.
    const userContent: unknown[] = [];
    for (const img of images) {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: img.media_type, data: img.data },
      });
    }
    userContent.push({ type: "text", text: userText });

    const client = getAnthropicClient();
    let inputTokens = 0;
    let outputTokens = 0;

    // deno-lint-ignore no-explicit-any
    const callModel = async (messages: any[]) => {
      const res = await client.messages.create({
        model: MODEL_SMART,
        max_tokens: 4096,
        system,
        messages,
      });
      inputTokens += res.usage?.input_tokens ?? 0;
      outputTokens += res.usage?.output_tokens ?? 0;
      return extractText(res);
    };

    // First attempt.
    // deno-lint-ignore no-explicit-any
    const messages: any[] = [{ role: "user", content: userContent }];
    let rawText = "";
    let result: ReturnType<typeof validateDesignSpec> | null = null;
    try {
      rawText = await callModel(messages);
      result = validateDesignSpec(parseJsonFromText(rawText));
    } catch (_e) {
      result = null;
    }

    // One repair retry if the model produced unparseable or empty output.
    if (!result || !isUsableSpec(result.spec)) {
      const reason = !result
        ? "Your previous response was not valid JSON."
        : `Your previous spec had issues: ${result.errors.join(" ")}`;
      try {
        const repairMessages = [
          { role: "user", content: userContent },
          { role: "assistant", content: rawText || "(no output)" },
          {
            role: "user",
            content: `${reason} Return ONLY a corrected JSON design spec that includes at least a hero block and exactly one form block. No prose, no markdown.`,
          },
        ];
        const repairText = await callModel(repairMessages);
        result = validateDesignSpec(parseJsonFromText(repairText));
      } catch (_e) {
        // fall through — if we have any result keep it, else error below.
      }
    }

    await recordAiTokens(admin, userId, inputTokens + outputTokens);

    // Require a USABLE spec (≥1 content block). validateDesignSpec never returns
    // null and always injects the form, so a form-only result is "valid" but
    // content-less — surface an error instead of returning a blank page.
    if (!result || !isUsableSpec(result.spec)) {
      return errorResponse(
        "The design generator could not produce a usable page. Please rephrase and try again.",
        502,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        spec: result.spec,
        notes: result.errors,
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("[generate-recruiting-design] error:", err);
    return errorResponse("Internal error generating design.", 500);
  }
});
