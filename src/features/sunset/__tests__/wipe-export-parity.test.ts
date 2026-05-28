// @vitest-environment node
//
// CI DRIFT TRIPWIRE for the platform-sunset wipe path.
//
// `wipe_user_business_data()` (migration 20260527060621) hardcodes five SQL
// arrays that pair positionally via `unnest(...)`. They MUST mirror the
// owned-tables registry that also drives the export bundle. If they drift, a
// user can permanently lose data they were never offered for download
// (export ⊄ wipe), or the wipe can silently skip a table. This test parses the
// SQL arrays and asserts they equal what the registry says they should be.
//
// The core assertions are pure-static (no DB). Optional live-catalog checks
// (column existence + FK-drift) run only under RUN_DB_TESTS=1.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ACTOR_REFS_TO_NULL,
  ACTOR_REFS_TO_REASSIGN,
  ALL_OWNED_TABLES,
  EXPORTED_TABLES,
  WIPE_ONLY_TABLES,
} from "../../../../supabase/functions/_shared/owned-tables";

const WIPE_SQL_PATH = fileURLToPath(
  new URL(
    "../../../../supabase/migrations/20260527060621_wipe_user_business_data_fn.sql",
    import.meta.url,
  ),
);
const wipeSql = readFileSync(WIPE_SQL_PATH, "utf8");

// Extract a `<name> text[] := ARRAY[ ... ]` literal's single-quoted tokens.
// Array literals contain no nested brackets, so [^\]]* is safe; SQL line
// comments (-- ...) are stripped before token extraction.
function extractSqlArray(sql: string, varName: string): string[] {
  const m = sql.match(
    new RegExp(`${varName}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([^\\]]*)\\]`),
  );
  if (!m) throw new Error(`SQL array '${varName}' not found in wipe migration`);
  const body = m[1].replace(/--[^\n]*/g, "");
  return [...body.matchAll(/'([^']*)'/g)].map((x) => x[1]);
}

// Positionally zip a (tables, cols) SQL array pair into sorted "table.column"
// keys, asserting equal length first (a length mismatch is a silent unnest bug).
function sqlPairs(tablesVar: string, colsVar: string): string[] {
  const tables = extractSqlArray(wipeSql, tablesVar);
  const cols = extractSqlArray(wipeSql, colsVar);
  expect(
    tables.length,
    `${tablesVar}.length (${tables.length}) must equal ${colsVar}.length (${cols.length}) — unnest pairs positionally`,
  ).toBe(cols.length);
  expect(tables.length).toBeGreaterThan(0);
  return tables.map((t, i) => `${t}.${cols[i]}`).sort();
}

const sorted = (xs: string[]) => [...xs].sort();

describe("wipe ⇄ owned-tables registry parity", () => {
  it("ACTOR_REFS_TO_NULL mirrors c_null_tables/c_null_cols", () => {
    const fromRegistry = sorted(
      ACTOR_REFS_TO_NULL.map((r) => `${r.table}.${r.column}`),
    );
    expect(sqlPairs("c_null_tables", "c_null_cols")).toEqual(fromRegistry);
  });

  it("ACTOR_REFS_TO_REASSIGN mirrors c_reassign_tables/c_reassign_cols", () => {
    const fromRegistry = sorted(
      ACTOR_REFS_TO_REASSIGN.map((r) => `${r.table}.${r.column}`),
    );
    expect(sqlPairs("c_reassign_tables", "c_reassign_cols")).toEqual(
      fromRegistry,
    );
  });

  it('wipe:"explicit" tables mirror c_explicit_tables/c_explicit_cols', () => {
    const fromRegistry = sorted(
      ALL_OWNED_TABLES.filter((t) => t.wipe === "explicit").map(
        (t) => `${t.table}.${t.ownerColumn}`,
      ),
    );
    expect(sqlPairs("c_explicit_tables", "c_explicit_cols")).toEqual(
      fromRegistry,
    );
  });
});

describe("export ⊆ wipe invariant", () => {
  it("every exported table is removed by the wipe (explicit array or CASCADE)", () => {
    const explicitPairs = new Set(
      sqlPairs("c_explicit_tables", "c_explicit_cols"),
    );
    for (const t of EXPORTED_TABLES) {
      const key = `${t.table}.${t.ownerColumn}`;
      if (t.wipe === "explicit") {
        expect(
          explicitPairs.has(key),
          `${key} is exported + wipe:"explicit" but missing from c_explicit_tables — it would survive the wipe`,
        ).toBe(true);
      } else {
        // wipe:"cascade" — removed when user_profiles is deleted; must NOT also
        // be in the explicit DELETE list (double-handling / wrong column).
        expect(
          explicitPairs.has(key),
          `${key} is wipe:"cascade" but also listed in c_explicit_tables`,
        ).toBe(false);
        expect(t.wipe).toBe("cascade");
      }
    }
  });
});

describe("registry hygiene", () => {
  it("no duplicate table in EXPORTED_TABLES", () => {
    const names = EXPORTED_TABLES.map((t) => t.table);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every exported row has a sheet label; every wipe-only row does not export", () => {
    for (const t of EXPORTED_TABLES) {
      expect(t.export, `${t.table} must have export:true`).toBe(true);
      expect(
        (t.sheet ?? "").length,
        `${t.table} (export:true) needs a non-empty sheet`,
      ).toBeGreaterThan(0);
    }
    for (const t of WIPE_ONLY_TABLES) {
      expect(t.export, `${t.table} must have export:false`).toBe(false);
    }
  });

  it("every owned table has a non-empty table + ownerColumn", () => {
    for (const t of ALL_OWNED_TABLES) {
      expect(t.table.length, "table name").toBeGreaterThan(0);
      expect(t.ownerColumn.length, `${t.table}.ownerColumn`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Live-catalog checks (gated; run with RUN_DB_TESTS=1, REMOTE via
// PARITY_DB_URL=$REMOTE_DATABASE_URL). Reused as a Step-7 remote pre-flight.
//
// Static parity (above) guards the SQL arrays vs the registry; these guard the
// registry vs the REAL catalog, which static parity cannot see:
//   1. Column existence — owner/actor-ref columns still exist (the wipe SQL uses
//      to_regclass and silently skips a renamed/dropped table).
//   2. FK-drift (M-A) — every NO-ACTION/RESTRICT FK to user_profiles is handled
//      by the wipe (else the whole wipe rolls back), and every registry
//      "cascade" table truly cascades (else its rows silently survive the wipe).
//
// One shared connection for the suite: the two catalog snapshots are fetched
// once in beforeAll, so the individual tests are pure in-memory assertions.
// ---------------------------------------------------------------------------
const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";
const DB_URL =
  process.env.PARITY_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const describeDb = RUN_DB_TESTS ? describe : describe.skip;

describeDb("live-catalog wipe checks", () => {
  // confdeltype: a=NO ACTION, r=RESTRICT, c=CASCADE, n=SET NULL, d=SET DEFAULT
  let client: import("pg").Client;
  let publicColumns: Set<string>; // "table.column" for every public column
  let userProfileFks: { key: string; onDelete: string }[]; // FKs -> user_profiles

  beforeAll(async () => {
    const { Client } = await import("pg");
    client = new Client({ connectionString: DB_URL });
    await client.connect();

    const cols = await client.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'`,
    );
    publicColumns = new Set(
      cols.rows.map((r) => `${r.table_name}.${r.column_name}`),
    );

    const fks = await client.query(
      `SELECT (c.conrelid::regclass)::text AS ref_table,
              a.attname AS ref_column,
              c.confdeltype AS on_delete
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f'
          AND c.confrelid = 'public.user_profiles'::regclass`,
    );
    userProfileFks = fks.rows.map((r) => ({
      key: `${String(r.ref_table).replace(/^public\./, "")}.${r.ref_column}`,
      onDelete: String(r.on_delete),
    }));
  });

  afterAll(async () => {
    await client?.end();
  });

  it("every owned table + actor-ref column exists in the catalog", () => {
    const refs = [
      ...ALL_OWNED_TABLES.map((t) => ({
        table: t.table,
        column: t.ownerColumn,
      })),
      ...ACTOR_REFS_TO_NULL,
      ...ACTOR_REFS_TO_REASSIGN,
    ];
    const missing = refs
      .map(({ table, column }) => `${table}.${column}`)
      .filter((key) => !publicColumns.has(key))
      .sort();
    expect(missing, `missing columns: ${missing.join(", ")}`).toEqual([]);
  });

  it("every NO-ACTION/RESTRICT FK to user_profiles is nulled, reassigned, or explicit-deleted", () => {
    const covered = new Set<string>([
      ...ACTOR_REFS_TO_NULL.map((r) => `${r.table}.${r.column}`),
      ...ACTOR_REFS_TO_REASSIGN.map((r) => `${r.table}.${r.column}`),
      // explicit-delete OWNER columns: the row is removed before user_profiles,
      // so a NO-ACTION FK on that owner column can't block the profile delete.
      ...ALL_OWNED_TABLES.filter((t) => t.wipe === "explicit").map(
        (t) => `${t.table}.${t.ownerColumn}`,
      ),
    ]);
    const blocking = userProfileFks
      .filter((f) => f.onDelete === "a" || f.onDelete === "r")
      .filter((f) => !covered.has(f.key))
      .map((f) => f.key)
      .sort();
    expect(
      blocking,
      `un-handled NO-ACTION/RESTRICT FK(s) to user_profiles — these will roll back the wipe: ${blocking.join(", ")}`,
    ).toEqual([]);
  });

  it('every registry wipe:"cascade" owner column is a real ON DELETE CASCADE FK', () => {
    const deleteByKey = new Map(userProfileFks.map((f) => [f.key, f.onDelete]));
    const notCascade = ALL_OWNED_TABLES.filter((t) => t.wipe === "cascade")
      .map((t) => ({
        key: `${t.table}.${t.ownerColumn}`,
        actual: deleteByKey.get(`${t.table}.${t.ownerColumn}`),
      }))
      .filter((x) => x.actual !== "c")
      .map((x) => `${x.key} (actual: ${x.actual ?? "no FK to user_profiles"})`)
      .sort();
    expect(
      notCascade,
      `registry says cascade but the catalog disagrees — these rows would survive the wipe: ${notCascade.join(", ")}`,
    ).toEqual([]);
  });

  // Regression guard for Phase-4 finding B2: the sunset edge functions SELECT a
  // fixed set of user_profiles columns. A missing column makes PostgREST 400 and
  // (because the `{ data }` destructure ignores the error) silently nulls the
  // profile lookup — which made confirm-and-wipe skip the wipe RPC entirely
  // (storage + auth deleted, business data kept). `full_name` is NOT a column
  // (it is computed from first_name + last_name); every projected column here
  // must exist in the live catalog.
  it("every user_profiles column the sunset edge functions select exists", () => {
    const projected = [
      // confirm-and-wipe-account, generate-user-export-bundle,
      // activate-imo-revocation, account-lifecycle-cron
      "id",
      "email",
      "first_name",
      "last_name",
      "imo_id",
      "is_super_admin",
      "created_at",
    ];
    const missing = projected
      .filter((col) => !publicColumns.has(`user_profiles.${col}`))
      .sort();
    expect(
      missing,
      `user_profiles is missing column(s) the sunset edge fns project (a 400 here silently skips the wipe): ${missing.join(", ")}`,
    ).toEqual([]);
    // Lock in the lesson: full_name must NOT be treated as a real column.
    expect(publicColumns.has("user_profiles.full_name")).toBe(false);
  });
});
