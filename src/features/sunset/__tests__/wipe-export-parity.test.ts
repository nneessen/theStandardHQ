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
// The core assertions are pure-static (no DB). An optional column-existence
// check against the live catalog runs only under RUN_DB_TESTS=1.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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
// Optional: column-existence against the live catalog. Static parity can't see
// a renamed/dropped column (the wipe SQL uses to_regclass and silently skips
// missing tables). Gated; reused as a Step-7 remote pre-flight via
// PARITY_DB_URL=$REMOTE_DATABASE_URL.
// ---------------------------------------------------------------------------
const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";
const DB_URL =
  process.env.PARITY_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const describeDb = RUN_DB_TESTS ? describe : describe.skip;

describeDb("owner columns exist in the live catalog", () => {
  it("every owned table + actor-ref column is present", async () => {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
      const refs = [
        ...ALL_OWNED_TABLES.map((t) => ({
          table: t.table,
          column: t.ownerColumn,
        })),
        ...ACTOR_REFS_TO_NULL,
        ...ACTOR_REFS_TO_REASSIGN,
      ];
      const missing: string[] = [];
      for (const { table, column } of refs) {
        const res = await client.query(
          `SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [table, column],
        );
        if (res.rowCount === 0) missing.push(`${table}.${column}`);
      }
      expect(missing, `missing columns: ${missing.join(", ")}`).toEqual([]);
    } finally {
      await client.end();
    }
  });
});
