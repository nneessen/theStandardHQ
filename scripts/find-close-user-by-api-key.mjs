#!/usr/bin/env node

import fs from 'node:fs/promises';
import process from 'node:process';

const DEFAULT_CLOSE_API_BASE_URL =
  process.env.CLOSE_API_BASE_URL ?? 'https://api.close.com/api/v1';
const API_KEY_REGEX = /\bapi_[A-Za-z0-9]+\.[A-Za-z0-9]+\b/g;

function printUsage() {
  console.log(`Usage:
  node scripts/find-close-user-by-api-key.mjs --input close-jobs.json
  node scripts/find-close-user-by-api-key.mjs --key api_xxx.yyy --key api_aaa.bbb
  pbpaste | node scripts/find-close-user-by-api-key.mjs --stdin

Options:
  --input <path>      Read JSON or plain text from a file
  --stdin             Read JSON or plain text from stdin
  --key <api_key>     Add a Close API key directly (repeatable)
  --match <text>      Only print keys whose org/user data matches this text
  --org-only          Only print org info for each key
  --json              Print machine-readable JSON output
  --show-key          Print the full API key instead of a redacted form
  --dry-run           Only extract keys and source references, do not call Close
  --timeout-ms <ms>   Per-request timeout in milliseconds (default: 15000)
  --help              Show this help text

Notes:
  - Close API keys are organization-scoped, so this script resolves each key to
    the organization plus the users in that organization.
  - The script will scan any input text for Close-style API keys, so it works
    with raw job JSON dumps like the one you pasted.
`);
}

function parseArgs(argv) {
  const options = {
    inputPath: null,
    readStdin: false,
    keys: [],
    match: null,
    orgOnly: false,
    json: false,
    showKey: false,
    dryRun: false,
    timeoutMs: 15_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--input':
        options.inputPath = requireValue(argv, ++index, '--input');
        break;
      case '--stdin':
        options.readStdin = true;
        break;
      case '--key':
        options.keys.push(requireValue(argv, ++index, '--key'));
        break;
      case '--match':
        options.match = requireValue(argv, ++index, '--match').trim();
        break;
      case '--org-only':
        options.orgOnly = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--show-key':
        options.showKey = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--timeout-ms':
        options.timeoutMs = parsePositiveInteger(
          requireValue(argv, ++index, '--timeout-ms'),
          '--timeout-ms'
        );
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index];

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function parsePositiveInteger(value, flag) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }

  return parsed;
}

async function readInputText(options) {
  const chunks = [];

  if (options.inputPath) {
    chunks.push(await fs.readFile(options.inputPath, 'utf8'));
  }

  const shouldReadImplicitStdin =
    !options.readStdin && !options.inputPath && !process.stdin.isTTY;

  if (options.readStdin || shouldReadImplicitStdin) {
    chunks.push(await readStdin());
  }

  return chunks.filter(Boolean).join('\n');
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function buildKeySourceMap({ directKeys, inputText }) {
  const sources = new Map();

  for (const key of directKeys) {
    addKeySource(sources, key, {
      source: 'cli',
      path: '--key',
      jobId: null,
    });
  }

  if (!inputText.trim()) {
    return sources;
  }

  const parsedJson = tryParseJson(inputText);

  if (parsedJson !== null) {
    collectKeysFromJson(parsedJson, sources);
  } else {
    collectKeysFromText(inputText, sources, {
      source: 'input',
      path: 'input',
      jobId: null,
    });
  }

  return sources;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function collectKeysFromJson(value, sources, path = 'root', context = {}) {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    collectKeysFromText(value, sources, {
      source: 'json',
      path,
      jobId: context.jobId ?? null,
    });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectKeysFromJson(item, sources, `${path}[${index}]`, context);
    });
    return;
  }

  if (typeof value === 'object') {
    const nextContext = {
      ...context,
      jobId: typeof value.job_id === 'string' ? value.job_id : context.jobId ?? null,
    };

    Object.entries(value).forEach(([key, nestedValue]) => {
      collectKeysFromJson(nestedValue, sources, `${path}.${key}`, nextContext);
    });
  }
}

function collectKeysFromText(text, sources, meta) {
  for (const match of text.matchAll(API_KEY_REGEX)) {
    addKeySource(sources, match[0], meta);
  }
}

function addKeySource(sources, key, meta) {
  if (!API_KEY_REGEX.test(key)) {
    API_KEY_REGEX.lastIndex = 0;
    return;
  }

  API_KEY_REGEX.lastIndex = 0;

  const existing =
    sources.get(key) ??
    {
      key,
      occurrences: 0,
      jobIds: new Set(),
      paths: new Set(),
      sourceKinds: new Set(),
    };

  existing.occurrences += 1;

  if (meta.jobId) {
    existing.jobIds.add(meta.jobId);
  }

  if (meta.path) {
    existing.paths.add(meta.path);
  }

  if (meta.source) {
    existing.sourceKinds.add(meta.source);
  }

  sources.set(key, existing);
}

function serializeKeySource(entry, showKey) {
  return {
    key: showKey ? entry.key : redactKey(entry.key),
    occurrences: entry.occurrences,
    jobIds: Array.from(entry.jobIds).sort(),
    paths: Array.from(entry.paths).sort(),
    sources: Array.from(entry.sourceKinds).sort(),
  };
}

async function fetchCloseJson(path, apiKey, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const url = new URL(trimLeadingSlash(path), `${options.baseUrl.replace(/\/+$/, '')}/`);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    const json = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      const details = extractErrorMessage(json, text);
      throw new Error(`${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }

    if (json === null) {
      throw new Error(`Unexpected non-JSON response from ${url.toString()}`);
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(json, fallbackText) {
  if (json && typeof json === 'object') {
    const candidates = [json.error, json.message, json.description];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return typeof fallbackText === 'string' ? fallbackText.trim().slice(0, 300) : '';
}

function trimLeadingSlash(value) {
  return value.replace(/^\/+/, '');
}

async function resolveApiKey(key, options) {
  const me = await fetchCloseJson('/me/', key, options);
  const organizationId =
    firstNonEmpty(
      me.organization_id,
      me.organization?.id,
      Array.isArray(me.organizations) ? me.organizations[0]?.id : null
    ) ?? null;

  if (!organizationId) {
    throw new Error('Could not determine organization id from /me/');
  }

  const organization = await fetchCloseJson(
    options.orgOnly
      ? `/organization/${organizationId}/`
      : `/organization/${organizationId}/?_expand=memberships__user,inactive_memberships__user`,
    key,
    options
  );

  return {
    organization: {
      id: organization.id ?? organizationId,
      name:
        firstNonEmpty(
          organization.name,
          organization.display_name,
          organization.organization_name
        ) ?? '(unknown organization)',
    },
    authenticatedUser: normalizeUserLike(me),
    activeUsers: options.orgOnly ? [] : normalizeMemberships(organization.memberships),
    inactiveUsers: options.orgOnly
      ? []
      : normalizeMemberships(organization.inactive_memberships),
  };
}

function normalizeMemberships(memberships) {
  if (!Array.isArray(memberships)) {
    return [];
  }

  return memberships
    .map(membership => {
      const user =
        membership && typeof membership.user === 'object' ? membership.user : membership;

      return {
        id: firstNonEmpty(user?.id, membership.user_id, membership.id) ?? null,
        name: formatName(user, membership),
        email:
          firstNonEmpty(
            user?.email,
            membership.user_email,
            membership.email,
            membership.user_name
          ) ?? null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeUserLike(value) {
  return {
    id: firstNonEmpty(value?.id, value?.user_id) ?? null,
    name: formatName(value),
    email: firstNonEmpty(value?.email, value?.user_email, value?.username) ?? null,
  };
}

function formatName(...candidates) {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const namedValue = firstNonEmpty(
      candidate.full_name,
      candidate.display_name,
      candidate.name,
      candidate.user_full_name,
      candidate.user_display_name,
      candidate.user_name
    );

    if (namedValue) {
      return namedValue;
    }

    const firstLast = joinName(candidate.first_name, candidate.last_name);

    if (firstLast) {
      return firstLast;
    }

    const userFirstLast = joinName(candidate.user_first_name, candidate.user_last_name);

    if (userFirstLast) {
      return userFirstLast;
    }

    if (candidate.email || candidate.user_email) {
      return candidate.email ?? candidate.user_email;
    }
  }

  return '(unknown user)';
}

function joinName(firstName, lastName) {
  const parts = [firstName, lastName].filter(
    value => typeof value === 'string' && value.trim().length > 0
  );

  return parts.length > 0 ? parts.join(' ') : null;
}

function firstNonEmpty(...values) {
  return (
    values.find(value => {
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }

      return value !== null && value !== undefined;
    }) ?? null
  );
}

function redactKey(key) {
  if (key.length <= 16) {
    return key;
  }

  return `${key.slice(0, 10)}...${key.slice(-4)}`;
}

function buildSearchText(result) {
  const parts = [
    result.organization.name,
    result.organization.id,
    result.authenticatedUser.name,
    result.authenticatedUser.email,
    ...result.activeUsers.flatMap(user => [user.name, user.email]),
    ...result.inactiveUsers.flatMap(user => [user.name, user.email]),
  ];

  return parts.filter(Boolean).join('\n').toLowerCase();
}

function formatList(values, maxItems = 6) {
  if (values.length === 0) {
    return 'none';
  }

  if (values.length <= maxItems) {
    return values.join(', ');
  }

  return `${values.slice(0, maxItems).join(', ')} (+${values.length - maxItems} more)`;
}

function renderHuman({ processedCount, matchedCount, results, orgOnly }) {
  console.log(`Processed ${processedCount} unique key(s).`);
  console.log(`Matched ${matchedCount} key(s).`);

  if (results.length === 0) {
    return;
  }

  results.forEach((result, index) => {
    const keyLabel = result.key;

    console.log('');
    console.log(`[${index + 1}/${results.length}] ${keyLabel}`);
    console.log(`  Occurrences: ${result.source.occurrences}`);

    if (result.source.jobIds.length > 0) {
      console.log(`  Job IDs: ${formatList(result.source.jobIds, 5)}`);
    }

    if (result.source.paths.length > 0) {
      console.log(`  Source paths: ${formatList(result.source.paths, 4)}`);
    }

    if (result.error) {
      console.log(`  Error: ${result.error}`);
      return;
    }

    console.log(
      `  Organization: ${result.organization.name} (${result.organization.id ?? 'unknown'})`
    );
    console.log(
      `  Authenticated user: ${result.authenticatedUser.name}${
        result.authenticatedUser.email ? ` <${result.authenticatedUser.email}>` : ''
      }`
    );

    if (orgOnly) {
      return;
    }

    console.log(`  Active users (${result.activeUsers.length}):`);
    if (result.activeUsers.length === 0) {
      console.log('    - none');
    } else {
      result.activeUsers.forEach(user => {
        console.log(`    - ${user.name}${user.email ? ` <${user.email}>` : ''}`);
      });
    }

    console.log(`  Inactive users (${result.inactiveUsers.length}):`);
    if (result.inactiveUsers.length === 0) {
      console.log('    - none');
    } else {
      result.inactiveUsers.forEach(user => {
        console.log(`    - ${user.name}${user.email ? ` <${user.email}>` : ''}`);
      });
    }
  });
}

async function main() {
  const cliOptions = parseArgs(process.argv.slice(2));
  const inputText = await readInputText(cliOptions);
  const keySourceMap = buildKeySourceMap({
    directKeys: cliOptions.keys,
    inputText,
  });
  const uniqueKeys = Array.from(keySourceMap.keys()).sort();

  if (uniqueKeys.length === 0) {
    throw new Error('No Close API keys were found in the provided input.');
  }

  if (cliOptions.dryRun) {
    const dryRunResults = uniqueKeys.map(key =>
      serializeKeySource(keySourceMap.get(key), cliOptions.showKey)
    );

    if (cliOptions.json) {
      console.log(JSON.stringify(dryRunResults, null, 2));
    } else {
      console.log(`Found ${dryRunResults.length} unique key(s):`);
      dryRunResults.forEach((entry, index) => {
        console.log('');
        console.log(`[${index + 1}/${dryRunResults.length}] ${entry.key}`);
        console.log(`  Occurrences: ${entry.occurrences}`);
        if (entry.jobIds.length > 0) {
          console.log(`  Job IDs: ${formatList(entry.jobIds, 5)}`);
        }
        if (entry.paths.length > 0) {
          console.log(`  Source paths: ${formatList(entry.paths, 4)}`);
        }
      });
    }

    return;
  }

  const options = {
    baseUrl: DEFAULT_CLOSE_API_BASE_URL,
    timeoutMs: cliOptions.timeoutMs,
    orgOnly: cliOptions.orgOnly,
  };
  const matchText = cliOptions.match?.toLowerCase() ?? null;
  const resolvedResults = [];

  for (const key of uniqueKeys) {
    const source = serializeKeySource(keySourceMap.get(key), cliOptions.showKey);

    try {
      const resolved = await resolveApiKey(key, options);
      const result = {
        key: cliOptions.showKey ? key : redactKey(key),
        source,
        ...resolved,
      };

      if (!matchText || buildSearchText(result).includes(matchText)) {
        resolvedResults.push(result);
      }
    } catch (error) {
      const failedResult = {
        key: cliOptions.showKey ? key : redactKey(key),
        source,
        error: error instanceof Error ? error.message : String(error),
      };

      if (!matchText || failedResult.error.toLowerCase().includes(matchText)) {
        resolvedResults.push(failedResult);
      }
    }
  }

  if (cliOptions.json) {
    console.log(
      JSON.stringify(
        {
          processedCount: uniqueKeys.length,
          matchedCount: resolvedResults.length,
          results: resolvedResults,
        },
        null,
        2
      )
    );
    return;
  }

  renderHuman({
    processedCount: uniqueKeys.length,
    matchedCount: resolvedResults.length,
    results: resolvedResults,
    orgOnly: cliOptions.orgOnly,
  });
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
