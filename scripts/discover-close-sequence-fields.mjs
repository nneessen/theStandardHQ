#!/usr/bin/env node
// Discover fields on a Close CRM sequence object.
// Specifically looking for the "run once per lead" vs "multiple times per lead" setting.
//
// Usage:
//   node scripts/discover-close-sequence-fields.mjs
//   CLOSE_API_KEY=api_xxx node scripts/discover-close-sequence-fields.mjs
//   node scripts/discover-close-sequence-fields.mjs --sequence-id seq_abc123

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function loadDotEnv(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore
  }
}

loadDotEnv(path.join(ROOT_DIR, '.env'));
loadDotEnv(path.join(ROOT_DIR, '.env.local'));

function parseArgs(argv) {
  const opts = { sequenceId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sequence-id') opts.sequenceId = argv[++i];
  }
  return opts;
}

const CLOSE_BASE = 'https://api.close.com/api/v1';
const API_KEY = process.env.CLOSE_API_KEY;

if (!API_KEY) {
  console.error('CLOSE_API_KEY not set in env/.env/.env.local');
  process.exit(1);
}

function authHeader() {
  return `Basic ${Buffer.from(`${API_KEY}:`).toString('base64')}`;
}

async function closeGet(pathname) {
  const url = `${CLOSE_BASE}${pathname}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: authHeader() },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${pathname} -> ${res.status} ${res.statusText}\n${text}`);
  }
  return JSON.parse(text);
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

function shortPreview(value) {
  const seen = new WeakSet();
  const j = JSON.stringify(
    value,
    (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
      }
      return v;
    },
    0
  );
  if (!j) return String(value);
  return j.length > 120 ? `${j.slice(0, 117)}...` : j;
}

const FIELD_RE = /run|subscrip|enroll|mode|once|multiple|repeat|recipient|reenroll|re_enroll|contact|per_lead/i;

async function main() {
  const { sequenceId } = parseArgs(process.argv.slice(2));

  let sequence;
  let allItems = [];
  if (sequenceId) {
    console.log(`Fetching specific sequence: ${sequenceId}`);
    sequence = await closeGet(`/sequence/${sequenceId}/`);
  } else {
    console.log('Fetching list of sequences from Close...');
    const list = await closeGet('/sequence/');
    allItems = Array.isArray(list?.data) ? list.data : [];
    console.log(`Found ${allItems.length} sequences on page.`);
    if (allItems.length === 0) {
      console.error('No sequences found in this org. Try creating one, or pass --sequence-id.');
      process.exit(2);
    }
    const first = allItems[0];
    console.log(`Using first sequence: ${first.id} (${first.name ?? '(unnamed)'})`);
    // Also fetch the individual endpoint — it may return extra fields vs. the list view.
    sequence = await closeGet(`/sequence/${first.id}/`);
  }

  console.log('\n=================================================================');
  console.log('TOP-LEVEL FIELDS ON SEQUENCE');
  console.log('=================================================================');
  const entries = Object.entries(sequence).sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of entries) {
    console.log(`  ${k.padEnd(32)} ${typeOf(v).padEnd(14)} ${shortPreview(v)}`);
  }

  console.log('\n=================================================================');
  console.log('FIELDS MATCHING /run|subscrip|enroll|mode|once|multiple|repeat|recipient/i');
  console.log('=================================================================');
  const matches = entries.filter(([k]) => FIELD_RE.test(k));
  if (matches.length === 0) {
    console.log('  (none on top level — checking nested)');
  } else {
    for (const [k, v] of matches) {
      console.log(`  ${k} = ${JSON.stringify(v, null, 2)}`);
    }
  }

  // Recursively find any nested matching fields
  console.log('\n=================================================================');
  console.log('NESTED MATCHING FIELDS (recursive)');
  console.log('=================================================================');
  const found = [];
  (function walk(obj, pathStr) {
    if (obj === null || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${pathStr}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      const p = pathStr ? `${pathStr}.${k}` : k;
      if (FIELD_RE.test(k)) found.push([p, v]);
      walk(v, p);
    }
  })(sequence, '');

  if (found.length === 0) {
    console.log('  (no nested matches)');
  } else {
    for (const [p, v] of found) {
      console.log(`  ${p} = ${shortPreview(v)}`);
    }
  }

  console.log('\n=================================================================');
  console.log('FULL SEQUENCE JSON (pretty)');
  console.log('=================================================================');
  console.log(JSON.stringify(sequence, null, 2));

  console.log('\n=================================================================');
  console.log('SCHEMA PROBE: compare against declared CloseSequence interface fields');
  console.log('=================================================================');
  const declared = new Set([
    'id',
    'name',
    'status',
    'steps',
    'organization_id',
    'date_created',
    'date_updated',
    'created_by',
    'updated_by',
  ]);
  const actual = new Set(Object.keys(sequence));
  const extra = [...actual].filter((k) => !declared.has(k));
  const missing = [...declared].filter((k) => !actual.has(k));
  console.log(`  Extra fields (present in API, missing in our interface): ${JSON.stringify(extra)}`);
  console.log(`  Missing fields (declared but not returned): ${JSON.stringify(missing)}`);

  // Scan additional sequences to find any that toggled the "run once vs multiple" setting.
  if (allItems.length > 1) {
    console.log('\n=================================================================');
    console.log('FIELD UNION ACROSS ALL SEQUENCES ON PAGE');
    console.log('=================================================================');
    const fieldMap = new Map();
    const sampleValues = new Map();
    for (const s of allItems) {
      for (const [k, v] of Object.entries(s)) {
        fieldMap.set(k, (fieldMap.get(k) ?? 0) + 1);
        if (!sampleValues.has(k)) sampleValues.set(k, new Set());
        const set = sampleValues.get(k);
        if (set.size < 5) {
          set.add(shortPreview(v));
        }
      }
    }
    const keys = [...fieldMap.keys()].sort();
    for (const k of keys) {
      const count = fieldMap.get(k);
      const samples = [...sampleValues.get(k)].join(' | ');
      console.log(`  ${k.padEnd(32)} present ${String(count).padStart(3)}/${allItems.length}  samples: ${samples.slice(0, 100)}`);
    }

    console.log('\n=================================================================');
    console.log('DIFF: sequences with unusual field sets (vs. first sequence)');
    console.log('=================================================================');
    const baseKeys = new Set(Object.keys(allItems[0]));
    for (const s of allItems) {
      const these = new Set(Object.keys(s));
      const add = [...these].filter((k) => !baseKeys.has(k));
      const rem = [...baseKeys].filter((k) => !these.has(k));
      if (add.length || rem.length) {
        console.log(`  ${s.id} (${s.name ?? ''})`);
        if (add.length) console.log(`    extra: ${JSON.stringify(add)}`);
        if (rem.length) console.log(`    missing: ${JSON.stringify(rem)}`);
      }
    }

    // If a "recipient/reenroll/run/once" field exists, dump all distinct values seen across sequences.
    const interesting = keys.filter((k) => FIELD_RE.test(k));
    if (interesting.length) {
      console.log('\n=================================================================');
      console.log('DISTINCT VALUES FOR MATCHING FIELDS ACROSS ALL SEQUENCES');
      console.log('=================================================================');
      for (const k of interesting) {
        const values = new Set();
        for (const s of allItems) {
          if (k in s) values.add(JSON.stringify(s[k]));
        }
        console.log(`  ${k}:`);
        for (const v of values) console.log(`    ${v.slice(0, 200)}`);
      }
    }

    // Fetch individual GET for multiple sequences to look for fields that are
    // returned only by the single-resource endpoint (not the list endpoint).
    console.log('\n=================================================================');
    console.log('FIELDS APPEARING ONLY IN INDIVIDUAL GET (sampled 5 sequences)');
    console.log('=================================================================');
    const listKeys = new Set(Object.keys(allItems[0]));
    const sampleCount = Math.min(5, allItems.length);
    const singleUnion = new Set();
    const singleSamples = [];
    for (let i = 0; i < sampleCount; i++) {
      try {
        const s = await closeGet(`/sequence/${allItems[i].id}/`);
        Object.keys(s).forEach((k) => singleUnion.add(k));
        singleSamples.push({ id: allItems[i].id, name: allItems[i].name, keys: Object.keys(s) });
      } catch (e) {
        console.log(`  failed ${allItems[i].id}: ${e.message}`);
      }
    }
    const onlyInSingle = [...singleUnion].filter((k) => !listKeys.has(k));
    console.log(`  list-endpoint keys:    ${[...listKeys].sort().join(', ')}`);
    console.log(`  single-endpoint keys:  ${[...singleUnion].sort().join(', ')}`);
    console.log(`  single-only fields:    ${JSON.stringify(onlyInSingle)}`);

    // Check _fields parameter expansion — sometimes Close hides fields by default.
    console.log('\n=================================================================');
    console.log("PROBING _fields=* EXPANSION ON FIRST SEQUENCE");
    console.log('=================================================================');
    try {
      const expanded = await closeGet(`/sequence/${allItems[0].id}/?_fields=*`);
      console.log(`  keys with _fields=*: ${Object.keys(expanded).sort().join(', ')}`);
      const newKeys = Object.keys(expanded).filter((k) => !singleUnion.has(k));
      console.log(`  new keys vs plain GET: ${JSON.stringify(newKeys)}`);
    } catch (e) {
      console.log(`  _fields=* probe failed: ${e.message}`);
    }

    // Probe the Subscription endpoint for hints about "run once" semantics.
    console.log('\n=================================================================');
    console.log('PROBING /sequence_subscription/ (first 3)');
    console.log('=================================================================');
    try {
      const subs = await closeGet(`/sequence_subscription/?sequence_id=${allItems[0].id}&_limit=3`);
      const data = Array.isArray(subs?.data) ? subs.data : [];
      console.log(`  found ${data.length} subscriptions for ${allItems[0].id}`);
      if (data[0]) {
        console.log(`  sample keys: ${Object.keys(data[0]).sort().join(', ')}`);
        const subMatches = Object.entries(data[0]).filter(([k]) => FIELD_RE.test(k));
        for (const [k, v] of subMatches) console.log(`    ${k} = ${shortPreview(v)}`);
      }
    } catch (e) {
      console.log(`  subscription probe failed: ${e.message}`);
    }
  }
}

main().catch((err) => {
  console.error('\nError:', err?.message ?? err);
  process.exit(1);
});
