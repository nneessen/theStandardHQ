// tests/sql/get_team_member_ids.test.ts
//
// Vitest wrapper that invokes tests/sql/get_team_member_ids.test.sql via the
// project's run-sql.sh script. The SQL file uses RAISE EXCEPTION for assertions
// and rolls back fixture data; this wrapper just asserts exit code 0 and the
// presence of the success marker.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const REPO_ROOT = resolve(__dirname, "../..");
const SCRIPT = resolve(REPO_ROOT, "scripts/migrations/run-sql.sh");
const SQL_FILE = resolve(REPO_ROOT, "tests/sql/get_team_member_ids.test.sql");

describe("get_team_member_ids integration (SQL)", () => {
  it("passes all RAISE-EXCEPTION assertions in the SQL test file", () => {
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
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const detail = [
        e.message ?? "unknown error",
        e.stdout ? `\n--- stdout ---\n${e.stdout}` : "",
        e.stderr ? `\n--- stderr ---\n${e.stderr}` : "",
      ].join("");
      if (/could not connect to server|connection refused/i.test(detail)) {
        console.warn(`SKIP: local Supabase DB not reachable\n${detail}`);
        return;
      }
      throw new Error(`SQL integration test failed:\n${detail}`);
    }

    expect(stdout).toMatch(
      /✅ All get_team_member_ids integration tests passed/,
    );
  }, 90_000);
});
