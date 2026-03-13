// supabase/functions/business-tools-proxy/index.ts
// Proxies all Paddle Parser API calls. Credentials stay server-side.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PADDLE_PARSER_URL = Deno.env
  .get("PADDLE_PARSER_URL")!
  .replace(/\/+$/, "");
// Normalize: strip trailing /api/v1 if present, then re-add it — handles both URL formats
const PADDLE_PARSER_BASE =
  PADDLE_PARSER_URL.replace(/\/api\/v1$/, "") + "/api/v1";
const PADDLE_PARSER_EMAIL = Deno.env.get("PADDLE_PARSER_EMAIL")!;
const PADDLE_PARSER_PASSWORD = Deno.env.get("PADDLE_PARSER_PASSWORD")!;

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const res = await fetch(`${PADDLE_PARSER_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: PADDLE_PARSER_EMAIL,
      password: PADDLE_PARSER_PASSWORD,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Paddle Parser auth failed: ${res.status} ${errText} (URL: ${PADDLE_PARSER_BASE}/auth/login)`,
    );
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Paddle Parser auth: no access_token in response`);
  }
  cachedToken = data.access_token;
  return cachedToken!;
}

async function paddleFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getToken();
  const res = await fetch(`${PADDLE_PARSER_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  // Token expired — retry once
  if (res.status === 401) {
    cachedToken = null;
    const newToken = await getToken();
    return fetch(`${PADDLE_PARSER_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
      },
    });
  }

  return res;
}

// Sanitize filename for Content-Disposition headers — strip injection chars
function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/["\r\n\x00-\x1f]/g, "_").slice(0, 255);
}

// Helper to decode base64 to Uint8Array
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side feature access check — mirrors frontend useFeatureAccess logic:
    // 1. Super admin bypass (owner email)
    // 2. Subscription plan feature check
    // 3. Owner-downline access (direct downlines get team-tier features)
    const SUPER_ADMIN_EMAIL = "nickneessen@thestandardhq.com";
    const userEmail = user.email?.toLowerCase() ?? "";
    const isSuperAdmin = userEmail === SUPER_ADMIN_EMAIL.toLowerCase();

    if (!isSuperAdmin) {
      const { data: hasFeature } = await supabase.rpc("user_has_feature", {
        p_user_id: user.id,
        p_feature: "business_tools",
      });

      if (!hasFeature) {
        // Check owner-downline access as fallback
        const { data: isDownline } = await supabase.rpc(
          "is_direct_downline_of_owner",
          { p_user_id: user.id },
        );

        if (!isDownline) {
          return new Response(
            JSON.stringify({
              error: "Business Tools feature not available on your plan",
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    const { action, params } = await req.json();

    let apiRes: Response;

    switch (action) {
      case "getTransactions": {
        const qs = new URLSearchParams();
        if (params?.limit) qs.set("limit", String(params.limit));
        if (params?.offset != null) qs.set("offset", String(params.offset));
        if (params?.trust_state) qs.set("trust_state", params.trust_state);
        if (params?.category) qs.set("category", params.category);
        apiRes = await paddleFetch(`/transactions?${qs.toString()}`);
        break;
      }
      case "getStatements": {
        const qs = new URLSearchParams();
        if (params?.limit) qs.set("limit", String(params.limit));
        if (params?.offset != null) qs.set("offset", String(params.offset));
        if (params?.trust_state) qs.set("trust_state", params.trust_state);
        if (params?.account_type) qs.set("account_type", params.account_type);
        apiRes = await paddleFetch(`/statements?${qs.toString()}`);
        break;
      }
      case "getCategories": {
        apiRes = await paddleFetch("/meta/categories");
        break;
      }
      case "getInstitutions": {
        apiRes = await paddleFetch("/meta/institutions");
        break;
      }
      case "batchInit": {
        // Single call to load transactions + categories + institutions in parallel
        const txQs = new URLSearchParams();
        txQs.set("limit", String(params?.limit ?? 50));
        txQs.set("offset", String(params?.offset ?? 0));
        if (params?.trust_state) txQs.set("trust_state", params.trust_state);
        if (params?.category) txQs.set("category", params.category);

        const [txRes, catRes, instRes] = await Promise.all([
          paddleFetch(`/transactions?${txQs.toString()}`),
          paddleFetch("/meta/categories"),
          paddleFetch("/meta/institutions"),
        ]);

        const [transactions, categories, institutions] = await Promise.all([
          txRes.json(),
          catRes.json(),
          instRes.json(),
        ]);

        return new Response(
          JSON.stringify({ transactions, categories, institutions }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      case "getJobStatus": {
        apiRes = await paddleFetch(`/jobs/${params.job_id}`);
        break;
      }
      case "runPipeline": {
        // Receive files as base64, forward as multipart/form-data
        const boundary = `----FormBoundary${Date.now()}`;
        const parts: Uint8Array[] = [];
        const encoder = new TextEncoder();

        // Add filing_month field
        if (params.filing_month) {
          parts.push(
            encoder.encode(
              `--${boundary}\r\nContent-Disposition: form-data; name="filing_month"\r\n\r\n${params.filing_month}\r\n`,
            ),
          );
        }

        // Add files
        for (const file of params.files || []) {
          const fileBytes = base64ToBytes(file.data);
          const header = encoder.encode(
            `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${sanitizeFilename(file.name)}"\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
          );
          const footer = encoder.encode("\r\n");
          parts.push(header, fileBytes, footer);
        }

        parts.push(encoder.encode(`--${boundary}--\r\n`));

        // Concatenate all parts
        const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
        const body = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) {
          body.set(part, offset);
          offset += part.length;
        }

        let pipelineToken = await getToken();
        apiRes = await fetch(`${PADDLE_PARSER_BASE}/pipeline/run`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pipelineToken}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: body,
        });
        // Token expired — retry once
        if (apiRes.status === 401) {
          cachedToken = null;
          pipelineToken = await getToken();
          apiRes = await fetch(`${PADDLE_PARSER_BASE}/pipeline/run`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${pipelineToken}`,
              "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
            body: body,
          });
        }
        break;
      }
      case "categorize": {
        const { id, ...payload } = params;
        apiRes = await paddleFetch(`/transactions/${id}/categorize`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        break;
      }
      case "approve": {
        const { id, reason } = params;
        apiRes = await paddleFetch(`/transactions/${id}/approve`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        break;
      }
      case "exclude": {
        const { id, reason } = params;
        apiRes = await paddleFetch(`/transactions/${id}/exclude`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        break;
      }
      case "bulkCategorize": {
        apiRes = await paddleFetch("/transactions/bulk/categorize", {
          method: "POST",
          body: JSON.stringify(params),
        });
        break;
      }
      case "bulkApprove": {
        apiRes = await paddleFetch("/transactions/bulk/approve", {
          method: "POST",
          body: JSON.stringify(params),
        });
        break;
      }
      case "bulkExclude": {
        apiRes = await paddleFetch("/transactions/bulk/exclude", {
          method: "POST",
          body: JSON.stringify(params),
        });
        break;
      }
      case "trustStatement": {
        const { id, reason } = params;
        apiRes = await paddleFetch(`/statements/${id}/trust`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        break;
      }
      case "getSummary": {
        // Server-side aggregation: fetch ALL transactions then compute stats
        const allTxns: Array<{
          direction: string;
          amount_cents: number;
          business_amount_cents: number;
          personal_amount_cents: number;
          category: string;
          transaction_kind: string;
          transaction_date: string;
          trust_state: string;
          excluded_from_totals: boolean;
          id: number;
          statement_id: number;
          post_date: string | null;
          description_raw: string;
          description_normalized: string | null;
          business_split_bps: number;
          review_reason: string | null;
        }> = [];
        let fetchOffset = 0;
        const fetchLimit = 200;
        const maxPages = 100; // Safety cap: 20,000 transactions max
        let hasMore = true;
        let pageCount = 0;

        while (hasMore && pageCount < maxPages) {
          pageCount++;
          const txQs = new URLSearchParams();
          txQs.set("limit", String(fetchLimit));
          txQs.set("offset", String(fetchOffset));
          const txRes = await paddleFetch(`/transactions?${txQs.toString()}`);
          const txData = await txRes.json();
          const items = txData.items || [];
          allTxns.push(...items);
          fetchOffset += fetchLimit;
          hasMore =
            items.length === fetchLimit && fetchOffset < (txData.total || 0);
        }

        // Compute totals — uses transaction_kind (not direction) to match API's own logic
        // Income kinds: positive business_amount_cents
        // Expense kinds: negative business_amount_cents (negate to get positive expense value)
        // Transfers/CC payments: neither bucket — only affect cash flow
        const INCOME_KINDS = new Set(["income", "interest"]);
        const EXPENSE_KINDS = new Set(["expense", "fee", "refund"]);

        let income_cents = 0;
        let expense_cents = 0;
        let business_expense_cents = 0;
        let personal_expense_cents = 0;
        let business_income_cents = 0;
        let needs_review_count = 0;
        let excluded_count = 0;
        let excluded_activity_cents = 0;
        let included_cash_flow_cents = 0;

        const catMap = new Map<
          string,
          { biz_income_cents: number; biz_expense_cents: number; count: number }
        >();
        const monthMap = new Map<
          string,
          {
            income_cents: number;
            expense_cents: number;
            personal_cents: number;
            net_cents: number;
            cash_flow_cents: number;
            excluded_cents: number;
          }
        >();
        const kindMap = new Map<
          string,
          { total_cents: number; count: number }
        >();

        for (const txn of allTxns) {
          if (txn.trust_state === "needs_review") needs_review_count++;

          const month = txn.transaction_date?.slice(0, 7) || "Unknown";
          const monthEntry = monthMap.get(month) || {
            income_cents: 0,
            expense_cents: 0,
            personal_cents: 0,
            net_cents: 0,
            cash_flow_cents: 0,
            excluded_cents: 0,
          };

          if (txn.excluded_from_totals || txn.trust_state === "excluded") {
            excluded_count++;
            excluded_activity_cents += txn.amount_cents;
            monthEntry.excluded_cents += txn.amount_cents;
            monthMap.set(month, monthEntry);
            continue;
          }

          included_cash_flow_cents += txn.amount_cents;
          monthEntry.cash_flow_cents += txn.amount_cents;

          const kind = txn.transaction_kind || "unknown";

          if (INCOME_KINDS.has(kind)) {
            income_cents += txn.business_amount_cents;
            business_income_cents += txn.business_amount_cents;
            monthEntry.income_cents += txn.business_amount_cents;
          } else if (EXPENSE_KINDS.has(kind)) {
            // business_amount_cents is negative for expenses; negate to get positive expense value
            expense_cents += -txn.amount_cents;
            business_expense_cents += -txn.business_amount_cents;
            personal_expense_cents += -txn.personal_amount_cents;
            monthEntry.expense_cents += -txn.business_amount_cents;
            monthEntry.personal_cents += -txn.personal_amount_cents;
          }
          // transfers, credit_card_payment, unknown → skip (cash flow only)

          monthEntry.net_cents =
            monthEntry.income_cents - monthEntry.expense_cents;
          monthMap.set(month, monthEntry);

          // Category breakdown (only for income/expense kinds)
          if (INCOME_KINDS.has(kind) || EXPENSE_KINDS.has(kind)) {
            const cat = txn.category || "Uncategorized";
            const catEntry = catMap.get(cat) || {
              biz_income_cents: 0,
              biz_expense_cents: 0,
              count: 0,
            };
            if (INCOME_KINDS.has(kind)) {
              catEntry.biz_income_cents += txn.business_amount_cents;
            } else {
              catEntry.biz_expense_cents += -txn.business_amount_cents;
            }
            catEntry.count += 1;
            catMap.set(cat, catEntry);
          }

          // Kind breakdown
          const kindEntry = kindMap.get(kind) || { total_cents: 0, count: 0 };
          kindEntry.total_cents += Math.abs(txn.amount_cents);
          kindEntry.count += 1;
          kindMap.set(kind, kindEntry);
        }

        const net_business_cents =
          business_income_cents - business_expense_cents;
        const total_expense = business_expense_cents + personal_expense_cents;
        const business_use_pct =
          total_expense > 0
            ? Math.round((business_expense_cents / total_expense) * 10000) / 100
            : 0;

        // Recent needs_review (last 10)
        const recent_review = allTxns
          .filter((t) => t.trust_state === "needs_review")
          .sort((a, b) =>
            (b.transaction_date || "").localeCompare(a.transaction_date || ""),
          )
          .slice(0, 10);

        const summary = {
          totals: {
            income_cents,
            expense_cents,
            business_expense_cents,
            personal_expense_cents,
            business_income_cents,
            net_business_cents,
            business_use_pct,
            transaction_count: allTxns.length,
            needs_review_count,
            excluded_count,
            excluded_activity_cents,
            included_cash_flow_cents,
          },
          by_category: Array.from(catMap.entries())
            .map(([category, v]) => ({ category, ...v }))
            .sort((a, b) => b.biz_expense_cents - a.biz_expense_cents),
          by_month: Array.from(monthMap.entries())
            .map(([month, v]) => ({ month, ...v }))
            .sort((a, b) => a.month.localeCompare(b.month)),
          by_kind: Array.from(kindMap.entries())
            .map(([kind, v]) => ({ kind, ...v }))
            .sort((a, b) => b.total_cents - a.total_cents),
          recent_review,
        };

        return new Response(JSON.stringify(summary), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "reviewWorkbook": {
        const boundary = `----FormBoundary${Date.now()}`;
        const parts: Uint8Array[] = [];
        const encoder = new TextEncoder();

        const fileBytes = base64ToBytes(params.file_data);
        const header = encoder.encode(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${sanitizeFilename(params.file_name || "workbook.xlsx")}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
        );
        const footer = encoder.encode("\r\n");
        parts.push(header, fileBytes, footer);
        parts.push(encoder.encode(`--${boundary}--\r\n`));

        const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
        const bodyData = new Uint8Array(totalLength);
        let bodyOffset = 0;
        for (const part of parts) {
          bodyData.set(part, bodyOffset);
          bodyOffset += part.length;
        }

        let wbToken = await getToken();
        apiRes = await fetch(`${PADDLE_PARSER_BASE}/review/workbook`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${wbToken}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: bodyData,
        });
        // Token expired — retry once
        if (apiRes.status === 401) {
          cachedToken = null;
          wbToken = await getToken();
          apiRes = await fetch(`${PADDLE_PARSER_BASE}/review/workbook`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${wbToken}`,
              "Content-Type": `multipart/form-data; boundary=${boundary}`,
            },
            body: bodyData,
          });
        }
        break;
      }
      case "requestInstitution": {
        apiRes = await paddleFetch("/meta/institution-requests", {
          method: "POST",
          body: JSON.stringify(params),
        });
        break;
      }
      case "exportWorkbook": {
        // Step 1: Generate workbook via POST
        const genRes = await paddleFetch("/export/workbook", {
          method: "POST",
          body: JSON.stringify({}),
        });
        if (!genRes.ok) {
          const errData = await genRes.json();
          return new Response(JSON.stringify(errData), {
            status: genRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Step 2: Download workbook via GET
        apiRes = await paddleFetch("/export/workbook");
        const blob = await apiRes.blob();
        return new Response(blob, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="business-workbook.xlsx"',
          },
        });
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
    }

    const data = await apiRes.json();
    return new Response(JSON.stringify(data), {
      status: apiRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
