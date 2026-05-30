#!/usr/bin/env node
// dbtype.mjs — slice a single type block out of src/types/database.types.ts
// instead of reading the whole 20k-line / ~162k-token generated file.
//
// Usage:
//   node scripts/dbtype.mjs <name>            print the block(s) for an exact
//                                             table / view / function / enum name
//   node scripts/dbtype.mjs --list            list every entity name, grouped
//   node scripts/dbtype.mjs --list tables     list one section
//                                             (tables|views|functions|enums)
//
// Why: each entity block is ~20-150 lines (a few hundred tokens) vs ~162k
// tokens for the whole file. Exact-match only by design (no fuzzy/over-engineering).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "..", "src", "types", "database.types.ts");

// Top-level sections live at 4-space indent: "    Tables: {"
const SECTION_RE = /^    (Tables|Views|Functions|Enums|CompositeTypes): \{$/;
// Entity keys live at 6-space indent: "      account_deletion_log: {"
const ENTITY_RE = /^      ([A-Za-z_][A-Za-z0-9_]*):/;

function loadLines() {
  try {
    return readFileSync(FILE, "utf8").split("\n");
  } catch (err) {
    console.error(`Cannot read ${FILE}: ${err.message}`);
    process.exit(1);
  }
}

// Walk the file, tagging each entity with its enclosing section.
// Returns [{ name, section, start, end }] where start/end are 0-based,
// end-exclusive line indices. Boundary = next sibling key at 6 spaces OR a
// line whose indent drops below 6 (section close). The block's own "};" sits
// at 6 spaces but starts with "}" not an identifier, so it is correctly kept.
function indexEntities(lines) {
  const entities = [];
  let section = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sec = SECTION_RE.exec(line);
    if (sec) {
      section = sec[1];
      continue;
    }
    const ent = ENTITY_RE.exec(line);
    if (ent && section) {
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = lines[j];
        if (l.trim() === "") continue;
        const indent = l.length - l.trimStart().length;
        if (indent < 6) break; // section close
        if (indent === 6 && ENTITY_RE.test(l)) break; // next sibling key
      }
      entities.push({ name: ent[1], section, start: i, end: j });
    }
  }
  return entities;
}

function doList(lines, filter) {
  const entities = indexEntities(lines);
  const sections = ["Tables", "Views", "Functions", "Enums", "CompositeTypes"];
  const wanted = filter ? filter.toLowerCase() : null;
  for (const s of sections) {
    if (wanted && s.toLowerCase() !== wanted) continue;
    const names = entities.filter((e) => e.section === s).map((e) => e.name);
    if (names.length === 0) continue;
    console.log(`\n${s} (${names.length}):`);
    console.log(names.join(", "));
  }
}

function doPrint(lines, name) {
  const matches = indexEntities(lines).filter((e) => e.name === name);
  if (matches.length === 0) {
    console.error(`No exact match for "${name}".`);
    console.error(`Run: node scripts/dbtype.mjs --list   to see all names.`);
    process.exit(2);
  }
  for (const m of matches) {
    console.log(
      `// ${m.section} › ${m.name}  (database.types.ts lines ${m.start + 1}-${m.end})`,
    );
    console.log(lines.slice(m.start, m.end).join("\n"));
    console.log("");
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/dbtype.mjs <name> | --list [section]");
  process.exit(1);
}

const lines = loadLines();
if (args[0] === "--list") {
  doList(lines, args[1]);
} else {
  doPrint(lines, args[0]);
}
