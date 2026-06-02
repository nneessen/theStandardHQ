// Flexible, RLS-scoped read over the `policies` table — the "no data gaps" tool.
// Lets the assistant LIST / COUNT / FILTER an agent's (or their team's) policies by
// application status, in-force lifecycle, product, and a date range, and returns the
// EXACT match count, the AP/IP sums over ALL matching policies (not just the returned
// sample), and a capped list of SAFE per-policy columns.
//
// TENANCY INVARIANT (do not weaken): runs on `ctx.db` — the signed-in user's
// RLS-scoped PostgREST client — and NEVER adminClient / a SECURITY DEFINER RPC. The
// `policies` RLS already scopes every read to own (user_id = auth.uid()) ∩ imo plus the
// caller's downline subtree (is_upline_of) ∩ imo, so `scope:'team'` can never surface
// another team's or another IMO's policies, and `scope:'mine'` only narrows further with
// an explicit user_id filter. RLS is the ceiling regardless of any argument the model
// passes; the filters below can only ever shrink the visible set, never widen it.
//
// PII: selects a FIXED safe-column allowlist only. The client's NAME and the carrier
// name are embedded read-only via their FKs — the same identification the app already
// shows the caller (mirrors getClientSnapshot), and the embed inherits the clients/
// carriers RLS, so it can only ever surface a client the caller is already allowed to
// see (own book; downline only if the caller's clients RLS permits). It STILL never
// selects client_id, client contact details (email/phone/DOB), notes,
// cancellation_reason, referral_source, lead_purchase_id, or any other user's id.
//
// COLUMN-NAME SAFETY: the only model-supplied COLUMN name is `dateField`, which is
// validated against a closed allowlist before it reaches the query (column names are not
// parameterized). Filter VALUES (status/lifecycle/product) are parameterized by
// PostgREST and so are injection-safe; `product` is additionally allowlisted because it
// is an ENUM and an out-of-vocabulary value would make Postgres throw.
//
// An empty result is a real "none" and is available:true — do NOT treat zero rows as
// unavailable.

import type {
  AssistantToolContext,
  RegisteredTool,
  ToolSelectBuilder,
} from "./types.ts";
import { optionalString } from "./types.ts";

const num = (v: unknown): number =>
  typeof v === "number" ? v : Number(v) || 0;

// Safe column allowlist. clients(name)/carriers(name) embed via the single
// policies_client_id_fkey / policies_carrier_id_fkey FKs (so each embed name is
// unambiguous); both inherit their table's RLS, so they only return rows the caller
// may already see — and ONLY the name, never contact PII.
const SAFE_COLS =
  "status, lifecycle_status, product, annual_premium, monthly_premium, " +
  "submit_date, effective_date, expiration_date, cancellation_date, " +
  "policy_number, payment_frequency, clients(name), carriers(name)";

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

// The AP/IP totals must cover EVERY matching policy, but the returned `policies`
// list is capped at `limit` to keep the model payload small — so when more rows
// match than were returned, the sums are computed by a second, numeric-only pass
// over all matches. PostgREST caps each response at max_rows (1000), so that pass
// paginates by a stable key. SUM_SAFETY_ROWS bounds the worst case (a pathologically
// large book) so the tool can never run unbounded; `premiumsComplete:false` is
// surfaced if it is ever hit.
const SUM_PAGE = 1000;
const SUM_SAFETY_ROWS = 50_000;

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
  const client = r.clients as { name?: unknown } | null | undefined;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    client: client && typeof client === "object" ? str(client.name) : null,
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

/** The resolved, already-validated filter set, shared by the display and sum passes. */
export interface PolicyFilters {
  scope: "mine" | "team";
  userId: string;
  statuses: string[] | null;
  lifecycles: string[] | null;
  products: string[];
  dateField: string;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Apply the row-matching filters (NOT order/limit/range, which differ per pass) to a
 * select builder. Sharing this between the display query and the sum pass guarantees
 * the AP/IP totals are summed over EXACTLY the rows the count and list describe — the
 * two passes can never drift apart.
 */
function applyPolicyFilters(
  q: ToolSelectBuilder,
  f: PolicyFilters,
): ToolSelectBuilder {
  if (f.scope === "mine") q = q.eq("user_id", f.userId);
  if (f.statuses) q = q.in("status", f.statuses);
  if (f.lifecycles) q = q.in("lifecycle_status", f.lifecycles);
  if (f.products.length > 0) q = q.in("product", f.products);
  if (f.startDate) q = q.gte(f.dateField, f.startDate);
  if (f.endDate) q = q.lte(f.dateField, f.endDate);
  return q;
}

/**
 * Sum annual/monthly premium over ALL matching policies (RLS-scoped), paginating past
 * PostgREST's max_rows cap. Ordered by `id` and walked with OFFSET (`.range`); the cursor
 * advances by the ACTUAL rows received (`from += batch.length`), never the requested page
 * size — so a short page can never skip rows UNDER A STABLE SNAPSHOT.
 *
 * KNOWN LIMITATION (code-review 2026-06-02): `policies.id` is a random UUID, so OFFSET
 * pagination is NOT concurrency-stable — a concurrent in-scope INSERT/DELETE during the
 * multi-page walk can shift offsets and skip or double-count a row, silently biasing the
 * total. Only reachable at scope:'team' with >1000 matches + a write mid-walk (not a factor
 * at current scale). Robust fix = KEYSET (`.gt("id", lastId)`); deferred so it migrates in
 * one pass with this money-path's offset-based test suite. Until then `premiumsComplete`
 * does NOT detect this skew.
 *
 * The cursor advances by the ACTUAL rows received (`from += batch.length`), never by the
 * requested page size — so a short page (e.g. if the server's max_rows is below pageSize)
 * can never skip rows. Termination is driven by the already-known `expectedCount` (the
 * display query's exact count), with an empty page as a defensive fallback if rows were
 * deleted mid-walk. `complete:false` means the safety bound was hit (or a page errored)
 * and the returned totals are a floor, not the exact total.
 *
 * pageSize / safetyRows are injectable for testing; production uses the module defaults.
 */
export async function sumAllPremiums(
  ctx: AssistantToolContext,
  filters: PolicyFilters,
  expectedCount: number,
  pageSize: number = SUM_PAGE,
  safetyRows: number = SUM_SAFETY_ROWS,
): Promise<{ annual: number; monthly: number; complete: boolean }> {
  let annual = 0;
  let monthly = 0;
  let from = 0;
  let seen = 0;

  for (;;) {
    const q = applyPolicyFilters(
      ctx.db.from("policies").select("annual_premium, monthly_premium"),
      filters,
    )
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    const { data, error } = await q;
    if (error) return { annual, monthly, complete: false };

    const batch = (data as Array<Record<string, unknown>>) ?? [];
    for (const r of batch) {
      annual += num(r.annual_premium);
      monthly += num(r.monthly_premium);
    }
    seen += batch.length;
    from += batch.length;

    // Done once we've covered the known total, or the result set is exhausted (empty
    // page — guards against a stale count if rows were deleted during the walk).
    if (batch.length === 0 || seen >= expectedCount) {
      return { annual, monthly, complete: true };
    }
    // Pathologically large book: stop and flag the totals as a floor, not the exact sum.
    if (from >= safetyRows) return { annual, monthly, complete: false };
  }
}

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  // Scope: default to the narrowest ('mine'). RLS still constrains 'team' to the
  // caller's own subtree; 'mine' adds an explicit user_id filter on top.
  const scope = input.scope === "team" ? "team" : "mine";

  const dateFieldRaw = optionalString(input, "dateField");
  const filters: PolicyFilters = {
    scope,
    userId: ctx.userId,
    statuses: optionalStringArray(input, "status", (s) => s.toLowerCase()),
    lifecycles: optionalStringArray(input, "lifecycleStatus", (s) =>
      s.toLowerCase(),
    ),
    // Allowlist product to valid enum values; a fully-invalid array → no product filter.
    products: (
      optionalStringArray(input, "product", (s) => s.toLowerCase()) ?? []
    ).filter((p) => PRODUCT_TYPES.has(p)),
    dateField:
      dateFieldRaw && DATE_FIELDS.has(dateFieldRaw)
        ? dateFieldRaw
        : "submit_date",
    startDate: optionalString(input, "startDate"),
    endDate: optionalString(input, "endDate"),
  };

  const limit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? Math.min(Math.max(1, Math.floor(input.limit)), HARD_LIMIT)
      : DEFAULT_LIMIT;

  const displayQuery = applyPolicyFilters(
    ctx.db.from("policies").select(SAFE_COLS, { count: "exact" }),
    filters,
  )
    .order(filters.dateField, { ascending: false })
    .limit(limit);

  const { data, count, error } = await displayQuery;
  if (error) return { available: false, reason: "unavailable" };

  const rows = (data as Array<Record<string, unknown>>) ?? [];
  const policies = rows.map(safeShape);
  // `count` is the EXACT total of all matching rows (PostgREST count:'exact'); the row
  // list itself is capped at `limit`, so the two can differ.
  const totalCount = typeof count === "number" ? count : policies.length;
  const truncated = totalCount > policies.length;

  // AP/IP totals must span ALL matches. When the list already holds every match, the
  // page reduce IS the exact total (no extra round-trip); otherwise sum across all rows.
  let totalAnnualPremium = policies.reduce((s, p) => s + p.annualPremium, 0);
  let totalMonthlyPremium = policies.reduce((s, p) => s + p.monthlyPremium, 0);
  let premiumsComplete = true;
  if (truncated) {
    const sums = await sumAllPremiums(ctx, filters, totalCount);
    totalAnnualPremium = sums.annual;
    totalMonthlyPremium = sums.monthly;
    premiumsComplete = sums.complete;
  }

  return {
    available: true,
    data: {
      scope,
      count: totalCount,
      returned: policies.length,
      // `count` is authoritative for "how many"; the `policies` list is a capped,
      // most-recent-first sample when truncated is true.
      truncated,
      // Sums cover EVERY matching policy (not just the returned sample). The only
      // exception is premiumsComplete:false — an exceptionally large book hit the
      // aggregation safety bound, so the totals are a floor; report them as approximate.
      totalAnnualPremium,
      totalMonthlyPremium,
      premiumsComplete,
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
