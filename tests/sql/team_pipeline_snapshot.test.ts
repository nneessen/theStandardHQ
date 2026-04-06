// tests/sql/team_pipeline_snapshot.test.ts
//
// Vitest wrapper that invokes tests/sql/team_pipeline_snapshot.test.sql via the
// project's run-sql.sh script. The SQL file uses RAISE EXCEPTION for assertions
// and rolls back fixture data; this wrapper just asserts exit code 0 and the
// presence of the success marker.
//
// SKIP behavior: if the local Supabase DB isn't available (e.g. CI without
// supabase up), this test logs and skips rather than failing. The integration
// test is meaningful only against a real Postgres with the project's schema.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const REPO_ROOT = resolve(__dirname, "../..");
const SCRIPT = resolve(REPO_ROOT, "scripts/migrations/run-sql.sh");
const SQL_FILE = resolve(
  REPO_ROOT,
  "tests/sql/team_pipeline_snapshot.test.sql",
);

describe("get_team_pipeline_snapshot integration (SQL)", () => {
  it("passes all RAISE-EXCEPTION assertions in the SQL test file", () => {
    // Skip gracefully if either the script or the SQL file is missing
    if (!existsSync(SCRIPT) || !existsSync(SQL_FILE)) {
      console.warn("SKIP: run-sql.sh or test SQL file not found");
      return;
    }

    let stdout: string;
    try {
      stdout = execFileSync(SCRIPT, ["-f", SQL_FILE], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60_000,
      });
    } catch (err: unknown) {
      // Surface SQL error output verbatim so failures are debuggable
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const detail = [
        e.message ?? "unknown error",
        e.stdout ? `\n--- stdout ---\n${e.stdout}` : "",
        e.stderr ? `\n--- stderr ---\n${e.stderr}` : "",
      ].join("");
      // If supabase isn't running locally, skip rather than fail.
      if (/could not connect to server|connection refused/i.test(detail)) {
        console.warn(`SKIP: local Supabase DB not reachable\n${detail}`);
        return;
      }
      throw new Error(`SQL integration test failed:\n${detail}`);
    }

    expect(stdout).toMatch(
      /✅ All team_pipeline_snapshot integration tests passed/,
    );
  }, 90_000);
});
