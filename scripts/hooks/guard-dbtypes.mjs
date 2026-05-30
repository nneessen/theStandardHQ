#!/usr/bin/env node
// guard-dbtypes.mjs — PreToolUse hook.
// Blocks accidental whole-file reads of src/types/database.types.ts (~162k tokens)
// by the main loop AND by async subagents. Redirects to scripts/dbtype.mjs.
//
// Covers two attack surfaces:
//   - Read tool : deny unless a small targeted slice (offset + limit <= MAX_LINES)
//   - Bash tool : deny bulk readers (cat/head/tail/sed/awk/less/more/bat/nl) aimed
//                 at the file. grep/rg/wc and `node scripts/dbtype.mjs` stay allowed.
//
// Wired via .claude/settings.json PreToolUse hooks (matchers: Read, Bash).

import { readFileSync } from "node:fs";

const TARGET = "database.types.ts";
const MAX_LINES = 500; // a targeted Read slice this small is fine
const BULK_READER = /^(cat|head|tail|sed|awk|less|more|bat|nl)\b/;

// True only when a bulk reader is actually consuming the file as input, i.e. a
// command segment that STARTS with a bulk reader and names the file. This avoids
// false positives where the filename merely appears as text (commit messages,
// echo) or where `cat <<'EOF'` is a heredoc, not a file read. Segments are split
// on shell boundaries so `git commit -m "$(cat <<EOF ... database.types.ts)"`
// stays allowed (the cat segment is a heredoc).
function isBulkReadOfTarget(command) {
  const segments = command.split(/\$\(|`|\|\||&&|\||;|\n/);
  for (const raw of segments) {
    const seg = raw.trimStart();
    const m = BULK_READER.exec(seg);
    if (!m) continue;
    if (m[1] === "cat" && /^cat\s*</.test(seg)) continue; // heredoc / redirection
    if (seg.includes(TARGET)) return true;
  }
  return false;
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

const SLICER_HINT =
  "database.types.ts is ~162k tokens — never read it whole. " +
  "Use the slicer instead:\n" +
  "  node scripts/dbtype.mjs <table|view|function|enum>   # one block (~hundreds of tokens)\n" +
  "  node scripts/dbtype.mjs --list [tables|views|functions|enums]   # just the names\n" +
  "If you truly need raw lines, Read with both offset and limit (limit <= " +
  MAX_LINES +
  ").";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // can't parse → don't block anything
}

const tool = payload.tool_name;
const input = payload.tool_input ?? {};

if (tool === "Read") {
  const path = String(input.file_path ?? "");
  if (path.endsWith(TARGET)) {
    const hasSlice =
      Number.isFinite(input.offset) &&
      Number.isFinite(input.limit) &&
      input.limit <= MAX_LINES;
    if (!hasSlice) deny(SLICER_HINT);
  }
} else if (tool === "Bash") {
  const cmd = String(input.command ?? "");
  if (isBulkReadOfTarget(cmd)) {
    deny(SLICER_HINT);
  }
}

process.exit(0); // allow
