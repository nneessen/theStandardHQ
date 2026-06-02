// Flexible, RLS-scoped read over the `policies` table — the "no data gaps" tool.
// Lets the assistant LIST / COUNT / FILTER an agent's (or their team's) policies by
// application status, in-force lifecycle, product, and a date range, and returns the
// EXACT match count, the AP/IP sums of the returned rows, and a capped list of SAFE
// per-policy columns.
//
// TENANCY INVARIANT (do not weaken): runs on `ctx.db` — the signed-in user's
// RLS-scoped PostgREST client — and NEVER adminClient / a SECURITY DEFINER RPC. The
// `policies` RLS already scopes every read to own (user_id = auth.uid()) ∩ imo plus the
// caller's downline subtree (is_upline_of) ∩ imo, so `scope:'team'` can never surface
// another team's or another IMO's policies, and `scope:'mine'` only narrows further with
// an explicit user_id filter. RLS is the ceiling regardless of any argument the model
// passes; the filters below can only ever shrink the visible set, never widen it.
//
// PII: selects a FIXED safe-column allowlist only — never notes, cancellation_reason,
// referral_source, client_id, lead_purchase_id, or any other user's id. The carrier
// name is embedded read-only via the carrier_id FK.
//
// COLUMN-NAME SAFETY: the only model-supplied COLUMN name is `dateField`, which is
// validated against a closed allowlist before it reaches the query (column names are not
// parameterized). Filter VALUES (status/lifecycle/product) are parameterized by
// PostgREST and so are injection-safe; `product` is additionally allowlisted because it
// is an ENUM and an out-of-vocabulary value would make Postgres throw.
//
// An empty result is a real "none" and is available:true — do NOT treat zero rows as
// unavailable.

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString } from "./types.ts";

const num = (v: unknown): number =>
  typeof v === "number" ? v : Number(v) || 0;

// Safe, non-PII column allowlist. carriers(name) embeds the carrier via the single
// policies_carrier_id_fkey FK (so the embed name is unambiguous).
const SAFE_COLS =
  "status, lifecycle_status, product, annual_premium, monthly_premium, " +
  "submit_date, effective_date, expiration_date, cancellation_date, " +
  "policy_number, payment_frequency, carriers(name)";

// `dateField` is a model-supplied COLUMN NAME interpolated into .gte/.lte/.order — it
// MUST be allowlisted (an arbitrary string would error or address an unintended column).
const DATE_FIELDS = new Set([
  "submit_date",
  "effective_date",
  "expiration_date",
  "cancellation_date",
]);

// `product` is the `product_type` ENUM. An out-of-vocabulary value (e.g. a model typo
// "term" instead of "term_life") makes Postgres throw "invalid input value for enum",
// which would surface as a false "no data". Allowlist server-side so a bad value never
// reaches the query; the tool description lists the exact strings for the model.
const PRODUCT_TYPES = new Set([
  "term_life",
  "whole_life",
  "universal_life",
  "variable_life",
  "health",
  "disability",
  "annuity",
  "indexed_universal_life",
  "participating_whole_life",
]);

const DEFAULT_LIMIT = 50;
const HARD_LIMIT = 200;

/**
 * Optional string[] from model input: coerce to strings, trim, drop empties, optionally
 * normalize (e.g. lowercase). Returns null when the key is absent or yields no values, so
 * an empty/garbage array becomes "no filter" rather than an impossible `.in(col, [])`.
 */
function optionalStringArray(
  input: Record<string, unknown>,
  key: string,
  normalize: (s: string) => string = (s) => s,
): string[] | null {
  const v = input[key];
  if (!Array.isArray(v)) return null;
  const out = v
    .map((x) => (typeof x === "string" ? normalize(x.trim()) : ""))
    .filter((x) => x !== "");
  return out.length > 0 ? out : null;
}

/** Map a raw row to ONLY the safe, non-PII fields (defence in depth over SAFE_COLS). */
function safeShape(r: Record<string, unknown>) {
  const carrier = r.carriers as { name?: unknown } | null | undefined;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    status: str(r.status),
    lifecycleStatus: str(r.lifecycle_status),
    product: str(r.product),
    annualPremium: num(r.annual_premium),
    monthlyPremium: num(r.monthly_premium),
    submitDate: str(r.submit_date),
    effectiveDate: str(r.effective_date),
    expirationDate: str(r.expiration_date),
    cancellationDate: str(r.cancellation_date),
    policyNumber: str(r.policy_number),
    paymentFrequency: str(r.payment_frequency),
    carrier:
      carrier && typeof carrier === "object" ? str(carrier.name) : null,
  };
}

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  // Scope: default to the narrowest ('mine'). RLS still constrains 'team' to the
  // caller's own subtree; 'mine' adds an explicit user_id filter on top.
  const scope = input.scope === "team" ? "team" : "mine";

  const statuses = optionalStringArray(input, "status", (s) => s.toLowerCase());
  const lifecycles = optionalStringArray(
    input,
    "lifecycleStatus",
    (s) => s.toLowerCase(),
  );
  // Allowlist product to valid enum values; a fully-invalid array → no product filter.
  const products = (
    optionalStringArray(input, "product", (s) => s.toLowerCase()) ?? []
  ).filter((p) => PRODUCT_TYPES.has(p));

  const dateFieldRaw = optionalString(input, "dateField");
  const dateField =
    dateFieldRaw && DATE_FIELDS.has(dateFieldRaw)
      ? dateFieldRaw
      : "submit_date";
  const startDate = optionalString(input, "startDate");
  const endDate = optionalString(input, "endDate");

  const limit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? Math.min(Math.max(1, Math.floor(input.limit)), HARD_LIMIT)
      : DEFAULT_LIMIT;

  let q = ctx.db.from("policies").select(SAFE_COLS, { count: "exact" });
  if (scope === "mine") q = q.eq("user_id", ctx.userId);
  if (statuses) q = q.in("status", statuses);
  if (lifecycles) q = q.in("lifecycle_status", lifecycles);
  if (products.length > 0) q = q.in("product", products);
  if (startDate) q = q.gte(dateField, startDate);
  if (endDate) q = q.lte(dateField, endDate);
  q = q.order(dateField, { ascending: false }).limit(limit);

  const { data, count, error } = await q;
  if (error) return { available: false, reason: "unavailable" };

  const rows = (data as Array<Record<string, unknown>>) ?? [];
  const policies = rows.map(safeShape);
  // `count` is the EXACT total of all matching rows (PostgREST count:'exact'); the row
  // list itself is capped at `limit`, so the two can differ.
  const totalCount = typeof count === "number" ? count : policies.length;

  return {
    available: true,
    data: {
      scope,
      count: totalCount,
      returned: policies.length,
      // The list is partial when more rows match than were returned — the AP/IP sums
      // below cover only the returned rows, so the model must report `count` as the
      // authoritative total when this is true.
      truncated: totalCount > policies.length,
      totalAnnualPremium: policies.reduce((s, p) => s + p.annualPremium, 0),
      totalMonthlyPremium: policies.reduce((s, p) => s + p.monthlyPremium, 0),
      policies,
    },
  };
}

export const queryPolicies: RegisteredTool = {
  name: "queryPolicies",
  inputSchema: {
    type: "object",
    properties: {
      scope: {
        type: "string",
        enum: ["mine", "team"],
        description:
          "Whose policies to query: 'mine' = the caller's own book (default); 'team' = the caller plus their downline. Both are RLS-scoped server-side — the model cannot widen beyond the caller's own team/IMO.",
      },
      status: {
        type: "array",
        items: {
          type: "string",
          enum: ["approved", "pending", "withdrawn", "denied"],
        },
        description:
          "Application-status filter (one or more of: approved, pending, withdrawn, denied). NOTE: 'pending' is an APPLICATION status here, not an in-force lifecycle state.",
      },
      lifecycleStatus: {
        type: "array",
        items: { type: "string", enum: ["active", "cancelled", "lapsed"] },
        description:
          "In-force lifecycle filter (one or more of: active, cancelled, lapsed). Distinct from application status — some approved policies have no lifecycle value yet, so do not equate the two.",
      },
      product: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "term_life",
            "whole_life",
            "universal_life",
            "variable_life",
            "health",
            "disability",
            "annuity",
            "indexed_universal_life",
            "participating_whole_life",
          ],
        },
        description:
          "Product-type filter. Use these EXACT values: term_life, whole_life, universal_life, variable_life, health, disability, annuity, indexed_universal_life, participating_whole_life.",
      },
      dateField: {
        type: "string",
        enum: [
          "submit_date",
          "effective_date",
          "expiration_date",
          "cancellation_date",
        ],
        description:
          "Which date column startDate/endDate and ordering apply to: submit_date = written/submitted (default); effective_date = in-force/effective as of; expiration_date = expiring; cancellation_date = cancelled/lapsed when.",
      },
      startDate: {
        type: "string",
        description: "Inclusive start date YYYY-MM-DD applied to dateField.",
      },
      endDate: {
        type: "string",
        description: "Inclusive end date YYYY-MM-DD applied to dateField.",
      },
      limit: {
        type: "number",
        description:
          "Max policy rows to return (default 50, hard cap 200). The exact total of all matches is always returned separately as `count`.",
      },
    },
    additionalProperties: false,
  },
  run,
};
