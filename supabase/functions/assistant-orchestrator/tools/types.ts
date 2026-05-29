// Tool layer shared types + helpers. Deliberately free of esm.sh imports so the
// whole tools/ layer is unit-testable offline with a fake client (see core/__tests__).
// The orchestrator (index.ts) creates the real user-scoped supabase client and casts
// it to ToolDbClient at the boundary.

/** Minimal structural surface of the user-scoped supabase client that tools use. */
export interface ToolDbClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
  from(table: string): {
    insert(values: Record<string, unknown>): {
      select(columns?: string): {
        single(): PromiseLike<{ data: { id: string } | null; error: unknown }>;
      };
    };
  };
}

/**
 * A read-only Close API client already bound to the signed-in user's key. Tools
 * only ever see `.get()` — the API key itself never reaches the tool layer.
 */
export interface CloseReadClient {
  get<T = unknown>(path: string): Promise<T>;
}

/**
 * Resolves the SIGNED-IN user's Close client (or null when their Close account
 * isn't connected). The provider closes over the verified `ctx.userId` and takes
 * NO user-id argument by design — a tool (or the model) cannot ask for another
 * user's key. Resolution is memoized per request so most turns pay nothing.
 */
export interface CloseProvider {
  getClient(): Promise<CloseReadClient | null>;
}

export interface AssistantToolContext {
  db: ToolDbClient;
  userId: string;
  imoId: string | null;
  conversationId: string;
  firstName?: string | null;
  /** Live Close CRM access for the signed-in user (read-only v1). */
  close: CloseProvider;
}

export interface RegisteredTool {
  name: string;
  /** JSON Schema for the Anthropic tool definition. */
  inputSchema: Record<string, unknown>;
  run: (
    input: Record<string, unknown>,
    ctx: AssistantToolContext,
  ) => Promise<unknown>;
}

export interface DataSection {
  available: boolean;
  reason?: string;
  data?: unknown;
}

/**
 * Convert a settled supabase result into a grounded section. Returns
 * available:false (never throws) so the model degrades gracefully and states
 * unavailability instead of fabricating. Empty arrays/null count as "no_data".
 */
export function toSection(
  settled: PromiseSettledResult<{ data: unknown; error: unknown }>,
  transform: (d: unknown) => unknown = (d) => d,
): DataSection {
  if (settled.status === "rejected")
    return { available: false, reason: "fetch_failed" };
  const value = settled.value ?? { data: null, error: "no_result" };
  if (value.error) return { available: false, reason: "unavailable" };
  const data = value.data;
  if (data == null || (Array.isArray(data) && data.length === 0)) {
    return { available: false, reason: "no_data" };
  }
  return { available: true, data: transform(data) };
}

export function requireString(
  input: Record<string, unknown>,
  key: string,
): string {
  const v = input[key];
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`Missing or invalid required field: ${key}`);
  }
  return v;
}

export function optionalString(
  input: Record<string, unknown>,
  key: string,
): string | null {
  const v = input[key];
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
