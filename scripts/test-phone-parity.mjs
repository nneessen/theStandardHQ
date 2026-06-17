#!/usr/bin/env node
/**
 * Phone-normalization parity gate: SQL public.normalize_phone_e164() vs the
 * canonical vector set in scripts/phone-parity-vectors.json.
 *
 * The SAME vectors are asserted against the TS twin (src/lib/phone.ts) by
 * src/lib/__tests__/phone.test.ts. SQL≡vectors AND TS≡vectors ⟹ SQL≡TS, which
 * is the correctness gate for the inbound-call Agent-of-Record GET lookup
 * (any divergence = silently missed lookups).
 *
 * Runs against whatever DB run-sql.sh targets (LOCAL by default; the migration
 * that creates normalize_phone_e164 must be applied there first).
 *
 *   node scripts/test-phone-parity.mjs
 *
 * Exit 0 on full parity, 1 on any mismatch or error.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const runSql = join(here, "migrations", "run-sql.sh");
const vectorsPath = join(here, "..", "src", "lib", "__tests__", "phone-parity-vectors.json");

const sqlLit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function main() {
  const { vectors } = JSON.parse(readFileSync(vectorsPath, "utf8"));
  if (!Array.isArray(vectors) || vectors.length === 0) {
    console.error("No vectors found in phone-parity-vectors.json");
    process.exit(1);
  }

  const valuesRows = vectors
    .map((v, i) => {
      const expected = v.expected === null ? "NULL::text" : sqlLit(v.expected);
      return `    (${i + 1}, ${sqlLit(v.input)}, ${expected})`;
    })
    .join(",\n");

  const cte = `WITH v(idx, input, expected) AS (\n  VALUES\n${valuesRows}\n)`;
  const sql = `\\set ON_ERROR_STOP on
${cte}
SELECT 'PARITY_' ||
       CASE WHEN count(*) FILTER (WHERE public.normalize_phone_e164(input) IS DISTINCT FROM expected) = 0
            THEN 'OK' ELSE 'FAIL' END
       || ' total=' || count(*)
       || ' mismatches=' || count(*) FILTER (WHERE public.normalize_phone_e164(input) IS DISTINCT FROM expected)
       AS result
FROM v;

${cte}
SELECT idx AS mismatch_idx, input, expected, public.normalize_phone_e164(input) AS got
FROM v
WHERE public.normalize_phone_e164(input) IS DISTINCT FROM expected
ORDER BY idx;
`;

  const dir = mkdtempSync(join(tmpdir(), "phone-parity-"));
  const sqlFile = join(dir, "parity.sql");
  writeFileSync(sqlFile, sql);

  let out = "";
  try {
    out = execFileSync("bash", [runSql, "-f", sqlFile], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    console.error("SQL execution failed:\n" + (err.stdout || "") + (err.stderr || err.message));
    process.exit(1);
  }

  console.log(out.trim());
  if (out.includes("PARITY_OK")) {
    console.log(`\n✓ SQL/TS phone parity: ${vectors.length} vectors match.`);
    process.exit(0);
  }
  console.error("\n✗ SQL/TS phone parity FAILED (see mismatch rows above).");
  process.exit(1);
}

main();
