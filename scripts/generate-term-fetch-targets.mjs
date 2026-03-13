#!/usr/bin/env node

import "dotenv/config";
import { Client } from "pg";
import { isManualOnlyTermProduct } from "./term-fetch-exclusions.mjs";

const VALID_SCOPES = new Set(["product", "group"]);
const VALID_FORMATS = new Set(["browser", "json", "summary"]);
const VALID_GRID_MODES = new Set(["metadata", "matrix", "explicit"]);
const VALID_AGE_SNAP_MODES = new Set(["supported", "none"]);
const VALID_FACE_SNAP_MODES = new Set(["supported", "none"]);
const VALID_MISSING_MODES = new Set(["combo", "class"]);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function printUsage() {
  console.error(`Usage:
  node scripts/generate-term-fetch-targets.mjs \\
    --carrier "American Amicable" \\
    --product "Term Made Simple" \\
    [--imo-id <uuid>] \\
    [--state IL] \\
    [--age-scope product|group] \\
    [--face-scope product|group] \\
    [--grid-mode metadata|matrix|explicit] \\
    [--age-min 25 --age-max 85 --age-step 1] \\
    [--age-snap supported|none] \\
    [--face-min 50000 --face-max 500000 --face-step 1000] \\
    [--face-snap supported|none] \\
    [--missing-mode combo|class] \\
    [--chunk-size 250 --chunk-number 1] \\
    [--limit 250 --offset 0] \\
    [--bootstrap-empty] \\
    [--format browser|json|summary]

What it does:
  - reads premium_matrix for the selected carrier/product
  - infers the existing request grid from your DB
  - finds request combinations whose expected health-class rows are incomplete
  - emits a browser-ready setTermFetcherTargets(...) block by default

  Important:
  grid-mode=metadata compares existing rows against a metadata-aware request grid using
  product underwriting bounds plus a carrier/global term fallback grid. This is the default.
  grid-mode=matrix only checks for holes inside the exact age/face grid already present in DB.
  grid-mode=explicit checks holes against a deliberate request grid that you control with
  --age-min/--age-max/--age-step and --face-min/--face-max/--face-step.
  age-snap=supported is the default for explicit mode. It trims requested ages
  down to the direct-quote ages already seen for the product/carrier/global grid and then
  applies group-specific age support where available.
  face-snap=supported is the default for explicit mode. It trims requested face amounts
  down to the direct-quote face amounts already seen for the product/carrier/global grid so
  you do not generate thousands of guaranteed 400 responses for unsupported face values and
  then applies group-specific face support where available.
  missing-mode=combo is the default. It targets only age/face request combinations that have
  zero existing premium_matrix rows. Use missing-mode=class only if you explicitly want to
  retry partially populated combos whose missing health classes may or may not be quoteable.
  Use --bootstrap-empty when the product has zero premium_matrix rows and you want to
  seed requests from the shared term grid plus the product's underwriting metadata.
  Use --chunk-size/--chunk-number when you want smaller pasteable batches instead of one run.
`);
}

function normalizeCarrierName(value) {
  return String(value || "").trim();
}

function toTitleCase(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  return String(value || "").trim();
}

function normalizeTobaccoLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "none" || normalized === "non_tobacco") return "None";
  if (normalized === "tobacco") return "Tobacco";
  return String(value || "").trim();
}

function uniqueSortedNumbers(values) {
  return [...new Set((values || []).map(Number))].filter(Number.isFinite).sort((a, b) => a - b);
}

function positiveNumbers(values) {
  return uniqueSortedNumbers(values).filter((value) => value > 0);
}

function createRange(min, max) {
  const start = Number(min);
  const end = Number(max);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return [];
  }

  const values = [];
  for (let current = start; current <= end; current += 1) {
    values.push(current);
  }
  return values;
}

function createSteppedRange(min, max, step = 1) {
  const start = Number(min);
  const end = Number(max);
  const increment = Number(step);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(increment) ||
    increment <= 0 ||
    start > end
  ) {
    return [];
  }

  const values = [];
  for (let current = start; current <= end; current += increment) {
    values.push(current);
  }
  return values;
}

function parseOptionalInteger(value, flagName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`Invalid ${flagName} value "${value}". Expected an integer.`);
  }

  return parsed;
}

function parseOptionalPositiveInteger(value, flagName) {
  const parsed = parseOptionalInteger(value, flagName);
  if (parsed === null) return null;
  if (parsed <= 0) {
    throw new Error(`Invalid ${flagName} value "${value}". Expected a positive integer.`);
  }
  return parsed;
}

function parseNumberList(value, flagName) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  const parsed = String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter(Number.isFinite);

  if (parsed.length === 0) {
    throw new Error(`Invalid ${flagName} value "${value}". Expected a comma-separated number list.`);
  }

  return uniqueSortedNumbers(parsed);
}

function sanitizeStorageKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function comboKey({ termYears, gender, tobaccoClass, age, faceAmount }) {
  return [
    String(termYears),
    String(gender).toLowerCase(),
    String(tobaccoClass).toLowerCase(),
    String(age),
    String(faceAmount),
  ].join("|");
}

function getMaxFaceForAge(product, age, termYears) {
  const productMaxFace = Number(product.maxFaceAmount);
  let maxFace =
    Number.isFinite(productMaxFace) && productMaxFace > 0
      ? productMaxFace
      : Number.POSITIVE_INFINITY;

  const tiers = product.metadata?.ageTieredFaceAmounts?.tiers;
  if (!Array.isArray(tiers)) {
    return maxFace;
  }

  const tier = tiers.find((candidate) => {
    const minAge = Number(candidate?.minAge);
    const maxAge = Number(candidate?.maxAge);
    return Number.isFinite(minAge) && Number.isFinite(maxAge) && age >= minAge && age <= maxAge;
  });

  if (!tier) {
    return maxFace;
  }

  const tierMaxFace = Number(tier.maxFaceAmount);
  if (Number.isFinite(tierMaxFace)) {
    maxFace = Math.min(maxFace, tierMaxFace);
  }

  if (Array.isArray(tier.termRestrictions)) {
    const matchingTermRestriction = tier.termRestrictions.find(
      (restriction) => Number(restriction?.termYears) === Number(termYears),
    );
    const termMaxFace = Number(matchingTermRestriction?.maxFaceAmount);
    if (Number.isFinite(termMaxFace)) {
      maxFace = Math.min(maxFace, termMaxFace);
    }
  }

  return maxFace;
}

function getEffectiveProductFaceBounds(product, fallbackFaceAmounts) {
  const faces = positiveNumbers(fallbackFaceAmounts);
  const minFaceAmount = Number(product.minFaceAmount);
  const maxFaceAmount = Number(product.maxFaceAmount);

  const resolvedMin =
    Number.isFinite(minFaceAmount) && minFaceAmount > 0
      ? minFaceAmount
      : faces[0] ?? 50000;
  const resolvedMax =
    Number.isFinite(maxFaceAmount) && maxFaceAmount > 0
      ? maxFaceAmount
      : faces[faces.length - 1] ?? 500000;

  return {
    minFaceAmount: Math.min(resolvedMin, resolvedMax),
    maxFaceAmount: Math.max(resolvedMin, resolvedMax),
  };
}

function inferMinimumIncrement(values) {
  const sorted = uniqueSortedNumbers(values);
  let minIncrement = null;

  for (let index = 1; index < sorted.length; index += 1) {
    const diff = sorted[index] - sorted[index - 1];
    if (diff <= 0) continue;
    if (minIncrement === null || diff < minIncrement) {
      minIncrement = diff;
    }
  }

  return minIncrement;
}

function compareTargets(left, right) {
  return (
    left.term.localeCompare(right.term, undefined, { numeric: true }) ||
    left.sex.localeCompare(right.sex) ||
    left.tobacco.localeCompare(right.tobacco) ||
    left.age - right.age ||
    left.faceAmount - right.faceAmount
  );
}

function sortTargets(targets) {
  targets.sort(compareTargets);
}

function sortTargetEntries(entries) {
  entries.sort((left, right) => {
    return (
      left.priority - right.priority ||
      right.actualClassCount - left.actualClassCount ||
      compareTargets(left.target, right.target)
    );
  });
}

function buildActualHealthClassesByCombo(snapshot) {
  const actualHealthClassesByCombo = new Map();
  for (const combo of snapshot.combos) {
    actualHealthClassesByCombo.set(
      comboKey({
        termYears: combo.term_years,
        gender: combo.gender,
        tobaccoClass: combo.tobacco_class,
        age: combo.age,
        faceAmount: combo.face_amount,
      }),
      new Set(combo.actual_health_classes ?? []),
    );
  }
  return actualHealthClassesByCombo;
}

function buildActualFacesByGroupAge(snapshot) {
  const facesByGroupAge = new Map();

  for (const combo of snapshot.combos) {
    const groupKey = [
      String(combo.term_years),
      String(combo.gender).toLowerCase(),
      String(combo.tobacco_class).toLowerCase(),
    ].join("|");
    const age = Number(combo.age);
    const faceAmount = Number(combo.face_amount);
    if (!Number.isFinite(age) || !Number.isFinite(faceAmount)) {
      continue;
    }

    let facesByAge = facesByGroupAge.get(groupKey);
    if (!facesByAge) {
      facesByAge = new Map();
      facesByGroupAge.set(groupKey, facesByAge);
    }

    let faces = facesByAge.get(age);
    if (!faces) {
      faces = new Set();
      facesByAge.set(age, faces);
    }

    faces.add(faceAmount);
  }

  return facesByGroupAge;
}

function comboIsAlreadyCovered({ actual, expectedHealthClasses, missingMode }) {
  if (missingMode === "combo") {
    return Boolean(actual?.size);
  }

  const missingHealthClasses =
    expectedHealthClasses.length > 0
      ? expectedHealthClasses.filter((healthClass) => !actual?.has(healthClass))
      : actual?.size
        ? []
        : ["unknown"];

  return missingHealthClasses.length === 0;
}

function buildExpectedGroups(snapshot, globalDefaults) {
  if (snapshot.groups.length > 0) {
    return snapshot.groups.map((group) => ({
      termYears: Number(group.term_years),
      gender: String(group.gender).toLowerCase(),
      tobaccoClass: String(group.tobacco_class).toLowerCase(),
      expectedHealthClasses: [...new Set(group.expected_health_classes ?? [])].sort(),
      supportedAges: uniqueSortedNumbers(group.ages ?? []),
      supportedFaceAmounts: uniqueSortedNumbers(group.face_amounts ?? []),
    }));
  }

  if ((globalDefaults.groupTemplates ?? []).length > 0) {
    return globalDefaults.groupTemplates.map((group) => ({
      termYears: Number(group.term_years),
      gender: String(group.gender).toLowerCase(),
      tobaccoClass: String(group.tobacco_class).toLowerCase(),
      expectedHealthClasses: [...new Set(group.expected_health_classes ?? [])].sort(),
      supportedAges: uniqueSortedNumbers(group.ages ?? []),
      supportedFaceAmounts: uniqueSortedNumbers(group.face_amounts ?? []),
    }));
  }

  const termYears = globalDefaults.termYears.length > 0 ? globalDefaults.termYears : [10, 15, 20, 25, 30];
  const genders =
    globalDefaults.genders.length > 0 ? globalDefaults.genders : ["female", "male"];
  const tobaccoClasses =
    globalDefaults.tobaccoClasses.length > 0
      ? globalDefaults.tobaccoClasses
      : ["non_tobacco", "tobacco"];

  return termYears.flatMap((termYear) =>
    genders.flatMap((gender) =>
      tobaccoClasses.map((tobaccoClass) => ({
        termYears: Number(termYear),
        gender,
        tobaccoClass,
        expectedHealthClasses: [],
        supportedAges: [],
        supportedFaceAmounts: [],
      })),
    ),
  );
}

function buildRequestedGrid({ args, product, snapshot, globalDefaults }) {
  const explicitAgeValues = parseNumberList(args.ages, "--ages");
  const explicitFaceValues = parseNumberList(args["face-values"], "--face-values");

  const ageMinArg = parseOptionalInteger(args["age-min"], "--age-min");
  const ageMaxArg = parseOptionalInteger(args["age-max"], "--age-max");
  const ageStepArg = parseOptionalPositiveInteger(args["age-step"], "--age-step");
  const ageSnapMode = String(args["age-snap"] || "supported")
    .trim()
    .toLowerCase();
  if (!VALID_AGE_SNAP_MODES.has(ageSnapMode)) {
    throw new Error(
      `Invalid --age-snap "${ageSnapMode}". Use supported or none.`,
    );
  }
  const faceMinArg = parseOptionalInteger(args["face-min"], "--face-min");
  const faceMaxArg = parseOptionalInteger(args["face-max"], "--face-max");
  const faceStepArg = parseOptionalPositiveInteger(args["face-step"], "--face-step");
  const faceSnapMode = String(args["face-snap"] || "supported")
    .trim()
    .toLowerCase();
  if (!VALID_FACE_SNAP_MODES.has(faceSnapMode)) {
    throw new Error(
      `Invalid --face-snap "${faceSnapMode}". Use supported or none.`,
    );
  }

  const hasExplicitGridArgs =
    explicitAgeValues.length > 0 ||
    explicitFaceValues.length > 0 ||
    ageMinArg !== null ||
    ageMaxArg !== null ||
    ageStepArg !== null ||
    faceMinArg !== null ||
    faceMaxArg !== null ||
    faceStepArg !== null;

  if (!hasExplicitGridArgs) {
    return null;
  }

  const effectiveAgeBounds = getEffectiveProductAgeBounds(
    product,
    snapshot.globalAges.length > 0 ? snapshot.globalAges : globalDefaults.ages,
  );
  const fallbackFaces =
    snapshot.globalFaceAmounts.length > 0
      ? snapshot.globalFaceAmounts
      : globalDefaults.faceAmounts;
  const effectiveFaceBounds = getEffectiveProductFaceBounds(product, fallbackFaces);

  const ageMin = ageMinArg ?? effectiveAgeBounds.minAge;
  const ageMax = ageMaxArg ?? effectiveAgeBounds.maxAge;
  const ageStep = ageStepArg ?? 1;
  const faceMin = faceMinArg ?? effectiveFaceBounds.minFaceAmount;
  const faceMax = faceMaxArg ?? effectiveFaceBounds.maxFaceAmount;
  const faceStep = faceStepArg ?? inferMinimumIncrement(fallbackFaces) ?? 1000;
  const supportedDirectAges = uniqueSortedNumbers(
    snapshot.globalAges.length > 0 ? snapshot.globalAges : globalDefaults.ages,
  );

  const requestedAges =
    explicitAgeValues.length > 0
      ? positiveNumbers(explicitAgeValues)
      : positiveNumbers(createSteppedRange(ageMin, ageMax, ageStep));
  const faceAmounts =
    explicitFaceValues.length > 0
      ? positiveNumbers(explicitFaceValues)
      : positiveNumbers(createSteppedRange(faceMin, faceMax, faceStep));
  const supportedDirectFaceAmounts = positiveNumbers(fallbackFaces);

  let effectiveFaceAmounts = faceAmounts;
  let skippedUnsupportedFaceAmounts = [];
  if (faceSnapMode === "supported" && supportedDirectFaceAmounts.length > 0) {
    const supportedSet = new Set(supportedDirectFaceAmounts);
    effectiveFaceAmounts = faceAmounts.filter((value) => supportedSet.has(value));
    skippedUnsupportedFaceAmounts = faceAmounts.filter(
      (value) => !supportedSet.has(value),
    );
  }

  if (requestedAges.length === 0) {
    throw new Error("Requested age grid is empty after applying explicit arguments.");
  }
  if (faceAmounts.length === 0) {
    throw new Error("Requested face grid is empty after applying explicit arguments.");
  }
  if (effectiveFaceAmounts.length === 0) {
    throw new Error(
      faceSnapMode === "supported"
        ? "Requested face grid has no overlap with supported direct-quote face amounts."
        : "Effective face grid is empty after applying explicit arguments.",
    );
  }

  let effectiveAges = requestedAges;
  let skippedUnsupportedAges = [];
  if (ageSnapMode === "supported" && supportedDirectAges.length > 0) {
    const supportedSet = new Set(supportedDirectAges);
    effectiveAges = requestedAges.filter((value) => supportedSet.has(value));
    skippedUnsupportedAges = requestedAges.filter((value) => !supportedSet.has(value));
  }
  if (effectiveAges.length === 0) {
    throw new Error(
      ageSnapMode === "supported"
        ? "Requested age grid has no overlap with supported direct-quote ages."
        : "Effective age grid is empty after applying explicit arguments.",
    );
  }

  return {
    ages: effectiveAges,
    requestedAges,
    supportedDirectAges,
    skippedUnsupportedAges,
    faceAmounts: effectiveFaceAmounts,
    requestedFaceAmounts: faceAmounts,
    supportedDirectFaceAmounts,
    skippedUnsupportedFaceAmounts,
    ageMin,
    ageMax,
    ageStep,
    faceMin,
    faceMax,
    faceStep,
    ageSnapMode,
    faceSnapMode,
  };
}

function sliceTargets(targets, { chunkSize, chunkNumber, limit, offset }) {
  const totalTargets = targets.length;
  let start = offset ?? 0;
  let end =
    limit === null || limit === undefined ? totalTargets : Math.min(start + limit, totalTargets);
  let selection = {
    totalTargets,
    returnedTargets: totalTargets,
    offset: start,
    limit: limit ?? null,
    chunkSize: null,
    chunkNumber: null,
    totalChunks: null,
  };

  if (chunkSize !== null) {
    const safeChunkNumber = chunkNumber ?? 1;
    const totalChunks = Math.max(Math.ceil(totalTargets / chunkSize), 1);
    if (safeChunkNumber < 1 || safeChunkNumber > totalChunks) {
      throw new Error(
        `Invalid --chunk-number "${safeChunkNumber}". Expected a value between 1 and ${totalChunks}.`,
      );
    }

    start = (safeChunkNumber - 1) * chunkSize;
    end = Math.min(start + chunkSize, totalTargets);
    selection = {
      totalTargets,
      returnedTargets: Math.max(end - start, 0),
      offset: start,
      limit: chunkSize,
      chunkSize,
      chunkNumber: safeChunkNumber,
      totalChunks,
    };
  } else {
    selection = {
      totalTargets,
      returnedTargets: Math.max(end - start, 0),
      offset: start,
      limit: limit ?? null,
      chunkSize: null,
      chunkNumber: null,
      totalChunks: null,
    };
  }

  return {
    targets: targets.slice(start, end),
    selection,
  };
}

function buildBrowserSnippet(result) {
  const targetSummary =
    result.selection.totalTargets === result.targets.length
      ? `${result.targets.length}`
      : `${result.targets.length}/${result.selection.totalTargets}`;
  const summaryComments = [
    `// ${result.product.carrierName} / ${result.product.productName}`,
    `// productId=${result.product.productId} imoId=${result.product.imoId}`,
    `// targetCombos=${targetSummary} strategy=${result.strategy} ageScope=${result.ageScope} faceScope=${result.faceScope} missingMode=${result.missingMode}`,
  ];

  if (result.strategy === "bootstrap-empty") {
    summaryComments.push(
      "// bootstrap-empty=true (product has no premium_matrix rows; targets inferred from shared term grid + product metadata)",
    );
  }

  if (result.requestedGrid) {
    summaryComments.push(
      `// requestedGrid ages=${result.requestedGrid.ageMin}-${result.requestedGrid.ageMax} step=${result.requestedGrid.ageStep} faces=${result.requestedGrid.faceMin}-${result.requestedGrid.faceMax} step=${result.requestedGrid.faceStep}`,
    );
    if (result.strategy === "explicit-grid") {
      summaryComments.push("// prioritization=observed-first");
    }
    if (result.requestedGrid.ageSnapMode === "supported") {
      summaryComments.push(
        `// ageSnap=supported effectiveAges=${result.requestedGrid.ages.length} skippedAges=${result.requestedGrid.skippedUnsupportedAges.length}`,
      );
    }
    if (result.requestedGrid.faceSnapMode === "supported") {
      summaryComments.push(
        `// faceSnap=supported effectiveFaces=${result.requestedGrid.faceAmounts.length} skippedFaces=${result.requestedGrid.skippedUnsupportedFaceAmounts.length}`,
      );
    }
  }

  if (result.selection.chunkSize !== null) {
    summaryComments.push(
      `// chunk=${result.selection.chunkNumber}/${result.selection.totalChunks} chunkSize=${result.selection.chunkSize} offset=${result.selection.offset}`,
    );
  } else if (
    result.selection.offset > 0 ||
    (result.selection.limit !== null && result.selection.limit < result.selection.totalTargets)
  ) {
    summaryComments.push(
      `// slice offset=${result.selection.offset} limit=${result.selection.limit ?? "all"} totalTargets=${result.selection.totalTargets}`,
    );
  }

  if (result.targets.length === 0) {
    return `${summaryComments.join("\n")}\nconsole.log(${JSON.stringify(
      `No missing premium_matrix request combinations were found for ${result.product.carrierName} / ${result.product.productName}.`,
    )});`;
  }

  const metadata = {
    label:
      result.selection.chunkSize !== null
        ? `${result.product.carrierName} / ${result.product.productName} / missing premium_matrix combos / chunk ${result.selection.chunkNumber} of ${result.selection.totalChunks}`
        : `${result.product.carrierName} / ${result.product.productName} / missing premium_matrix combos`,
    carrierName: result.product.carrierName,
    productName: result.product.productName,
    state: result.state,
    stateStorageKey: `__termFetcherState_dynamic_${sanitizeStorageKey(
      `${result.product.carrierName}_${result.product.productName}_${result.state}${
        result.selection.chunkSize !== null
          ? `_chunk_${result.selection.chunkNumber}_of_${result.selection.totalChunks}`
          : result.selection.offset > 0 || result.selection.limit !== null
            ? `_offset_${result.selection.offset}_limit_${result.selection.limit ?? "all"}`
            : ""
      }`,
    )}`,
    generatedAt: result.generatedAt,
    source: {
      productId: result.product.productId,
      imoId: result.product.imoId,
      ageScope: result.ageScope,
      faceScope: result.faceScope,
      expectedGroupCount: result.summary.expectedGroupCount,
      totalTargets: result.selection.totalTargets,
      returnedTargets: result.targets.length,
      strategy: result.strategy,
      missingMode: result.missingMode,
      prioritization:
        result.strategy === "explicit-grid" ? "observed-first" : null,
      requestedGrid: result.requestedGrid,
      selection: result.selection,
    },
  };

  return `${summaryComments.join("\n")}\nsetTermFetcherTargets(\n${JSON.stringify(
    result.targets,
    null,
    2,
  )},\n${JSON.stringify(metadata, null, 2)}\n);`;
}

async function resolveProduct(client, { carrierName, productName, imoId }) {
  const { rows } = await client.query(
    `
      select
        p.id,
        p.imo_id,
        p.name,
        p.product_type,
        p.min_age,
        p.max_age,
        p.min_face_amount,
        p.max_face_amount,
        p.metadata,
        c.name as carrier_name
      from products p
      join carriers c
        on c.id = p.carrier_id
      where lower(c.name) = lower($1)
        and lower(p.name) = lower($2)
        and ($3::uuid is null or p.imo_id = $3::uuid)
      order by p.updated_at desc nulls last, p.created_at desc nulls last
    `,
    [carrierName, productName, imoId ?? null],
  );

  if (rows.length === 0) {
    throw new Error(`No product found for carrier="${carrierName}" product="${productName}".`);
  }

  if (rows.length > 1 && !imoId) {
    const matches = rows
      .map((row) => `  product_id=${row.id} imo_id=${row.imo_id ?? "null"}`)
      .join("\n");
    throw new Error(
      `Multiple matching products found. Re-run with --imo-id.\n${matches}`,
    );
  }

  const row = rows[0];
  return {
    productId: row.id,
    imoId: row.imo_id,
    carrierName: row.carrier_name,
    productName: row.name,
    productType: row.product_type,
    minAge: row.min_age,
    maxAge: row.max_age,
    minFaceAmount: row.min_face_amount,
    maxFaceAmount: row.max_face_amount,
    metadata: row.metadata ?? null,
  };
}

async function loadMatrixSnapshot(client, product) {
  const baseParams = [product.productId, product.imoId];

  const [groupResult, comboResult, globalResult] = await Promise.all([
    client.query(
      `
        select
          term_years,
          gender,
          tobacco_class,
          array_agg(distinct age order by age) as ages,
          array_agg(distinct face_amount order by face_amount) as face_amounts,
          array_agg(distinct health_class order by health_class) as expected_health_classes
        from premium_matrix
        where product_id = $1
          and imo_id = $2
        group by term_years, gender, tobacco_class
        order by term_years, gender, tobacco_class
      `,
      baseParams,
    ),
    client.query(
      `
        select
          term_years,
          gender,
          tobacco_class,
          age,
          face_amount,
          array_agg(distinct health_class order by health_class) as actual_health_classes
        from premium_matrix
        where product_id = $1
          and imo_id = $2
        group by term_years, gender, tobacco_class, age, face_amount
      `,
      baseParams,
    ),
    client.query(
      `
        select
          array_agg(distinct age order by age) as ages,
          array_agg(distinct face_amount order by face_amount) as face_amounts
        from premium_matrix
        where product_id = $1
          and imo_id = $2
      `,
      baseParams,
    ),
  ]);

  return {
    groups: groupResult.rows,
    combos: comboResult.rows,
    globalAges: uniqueSortedNumbers(globalResult.rows[0]?.ages ?? []),
    globalFaceAmounts: uniqueSortedNumbers(globalResult.rows[0]?.face_amounts ?? []),
  };
}

async function loadBootstrapDefaults(client, carrierName = null) {
  const whereClause = `
    where term_years is not null
      and ($1::text is null or product_id in (
        select p.id
        from products p
        join carriers c
          on c.id = p.carrier_id
        where p.product_type = 'term_life'
          and lower(c.name) = lower($1)
      ))
  `;

  const [defaultsResult, groupTemplateResult] = await Promise.all([
    client.query(
      `
        select
          array_agg(distinct age order by age) as ages,
          array_agg(distinct face_amount order by face_amount) as face_amounts,
          array_agg(distinct term_years order by term_years) as term_years,
          array_agg(distinct gender order by gender) as genders,
          array_agg(distinct tobacco_class order by tobacco_class) as tobacco_classes
        from premium_matrix
        ${whereClause}
      `,
      [carrierName],
    ),
    client.query(
      `
        select
          term_years,
          gender,
          tobacco_class,
          array_agg(distinct age order by age) as ages,
          array_agg(distinct face_amount order by face_amount) as face_amounts,
          array_agg(distinct health_class order by health_class) as expected_health_classes
        from premium_matrix
        ${whereClause}
        group by term_years, gender, tobacco_class
        order by term_years, gender, tobacco_class
      `,
      [carrierName],
    ),
  ]);

  const { rows } = defaultsResult;
  const defaults = {
    ages: uniqueSortedNumbers(rows[0]?.ages ?? []),
    faceAmounts: uniqueSortedNumbers(rows[0]?.face_amounts ?? []),
    termYears: uniqueSortedNumbers(rows[0]?.term_years ?? []),
    genders: [...new Set((rows[0]?.genders ?? []).map((value) => String(value).toLowerCase()))]
      .filter(Boolean)
      .sort(),
    tobaccoClasses: [
      ...new Set((rows[0]?.tobacco_classes ?? []).map((value) => String(value).toLowerCase())),
    ]
      .filter(Boolean)
      .sort(),
    groupTemplates: groupTemplateResult.rows,
  };

  if (
    defaults.ages.length > 0 &&
    defaults.faceAmounts.length > 0 &&
    defaults.termYears.length > 0
  ) {
    return defaults;
  }

  return {
    ...(carrierName ? await loadBootstrapDefaults(client, null) : defaults),
  };
}

function getEffectiveProductAgeBounds(product, fallbackAges) {
  const tiers = product.metadata?.ageTieredFaceAmounts?.tiers;
  if (Array.isArray(tiers) && tiers.length > 0) {
    const tierAges = tiers.flatMap((tier) => {
      const minAge = Number(tier?.minAge);
      const maxAge = Number(tier?.maxAge);
      return createRange(minAge, maxAge);
    });

    const ages = uniqueSortedNumbers(tierAges);
    if (ages.length > 0) {
      return {
        minAge: ages[0],
        maxAge: ages[ages.length - 1],
      };
    }
  }

  const minAge = Number(product.minAge);
  const maxAge = Number(product.maxAge);
  if (
    Number.isFinite(minAge) &&
    Number.isFinite(maxAge) &&
    minAge > 0 &&
    maxAge < 120 &&
    minAge <= maxAge
  ) {
    return { minAge, maxAge };
  }

  const ages = uniqueSortedNumbers(fallbackAges);
  if (ages.length > 0) {
    return {
      minAge: ages[0],
      maxAge: ages[ages.length - 1],
    };
  }

  return {
    minAge: 18,
    maxAge: 80,
  };
}

function buildTermAgeFaceIndex(snapshot, termYears) {
  const combos = snapshot.combos.filter(
    (combo) => Number(combo.term_years) === Number(termYears),
  );

  const allAges = uniqueSortedNumbers(combos.map((combo) => combo.age));
  const anchorAges = allAges.filter((age) => age % 5 === 0);
  const requestAges = anchorAges.length > 0 ? anchorAges : allAges;

  const facesByAge = new Map();
  for (const age of requestAges) {
    const faceAmounts = positiveNumbers(
      combos
        .filter((combo) => Number(combo.age) === Number(age))
        .map((combo) => combo.face_amount),
    );

    if (faceAmounts.length > 0) {
      facesByAge.set(age, faceAmounts);
    }
  }

  return {
    requestAges,
    facesByAge,
  };
}

function getNearestAgeFaceAmounts(facesByAge, age) {
  const ages = [...facesByAge.keys()].sort((left, right) => left - right);
  if (ages.length === 0) {
    return [];
  }

  let nearestAge = ages[0];
  let nearestDistance = Math.abs(nearestAge - age);

  for (const candidateAge of ages.slice(1)) {
    const distance = Math.abs(candidateAge - age);
    if (distance < nearestDistance) {
      nearestAge = candidateAge;
      nearestDistance = distance;
    }
  }

  return facesByAge.get(nearestAge) ?? [];
}

function generateMetadataGridTargets({ product, snapshot, globalDefaults, missingMode }) {
  const actualHealthClassesByCombo = buildActualHealthClassesByCombo(snapshot);

  const rawMinFaceAmount = Number(product.minFaceAmount);
  const rawMaxFaceAmount = Number(product.maxFaceAmount);
  const minFaceAmount =
    Number.isFinite(rawMinFaceAmount) && rawMinFaceAmount > 0 ? rawMinFaceAmount : null;
  const maxFaceAmount =
    Number.isFinite(rawMaxFaceAmount) && rawMaxFaceAmount > 0 ? rawMaxFaceAmount : null;
  const targets = [];
  const seen = new Set();
  const missingCountsByGroup = [];

  for (const group of snapshot.groups) {
    const termYears = Number(group.term_years);
    const gender = String(group.gender).toLowerCase();
    const tobaccoClass = String(group.tobacco_class).toLowerCase();
    const expectedHealthClasses = [...new Set(group.expected_health_classes ?? [])].sort();
    const { requestAges, facesByAge } = buildTermAgeFaceIndex(snapshot, termYears);
    const candidateAges = requestAges;

    let missingCount = 0;

    for (const age of candidateAges) {
      const maxFaceForAge = getMaxFaceForAge(product, age, termYears);
      if (Number.isNaN(maxFaceForAge) || maxFaceForAge <= 0) {
        continue;
      }

      const candidateFaceAmounts =
        facesByAge.get(age) ?? getNearestAgeFaceAmounts(facesByAge, age);

      for (const faceAmount of candidateFaceAmounts) {
        if (Number.isFinite(minFaceAmount) && faceAmount < minFaceAmount) {
          continue;
        }
        if (Number.isFinite(maxFaceAmount) && faceAmount > maxFaceAmount) {
          continue;
        }
        if (faceAmount > maxFaceForAge) {
          continue;
        }

        const key = comboKey({
          termYears,
          gender,
          tobaccoClass,
          age,
          faceAmount,
        });
        if (seen.has(key)) {
          continue;
        }

        const actual = actualHealthClassesByCombo.get(key);
        if (
          comboIsAlreadyCovered({
            actual,
            expectedHealthClasses,
            missingMode,
          })
        ) {
          continue;
        }

        seen.add(key);
        targets.push({
          sex: toTitleCase(gender),
          tobacco: normalizeTobaccoLabel(tobaccoClass),
          term: String(termYears),
          age,
          faceAmount,
        });
        missingCount += 1;
      }
    }

    missingCountsByGroup.push({
      termYears,
      gender,
      tobaccoClass,
      expectedHealthClasses,
      missingCombos: missingCount,
    });
  }

  sortTargets(targets);

  return {
    targets,
    summary: {
      expectedGroupCount: snapshot.groups.length,
      missingCountsByGroup,
    },
  };
}

function generateExplicitGridTargets({
  product,
  snapshot,
  globalDefaults,
  requestedGrid,
  missingMode,
}) {
  const actualHealthClassesByCombo = buildActualHealthClassesByCombo(snapshot);
  const actualFacesByGroupAge = buildActualFacesByGroupAge(snapshot);
  const groups = buildExpectedGroups(snapshot, globalDefaults);
  const directSupportedAgeSet = new Set(requestedGrid.supportedDirectAges ?? []);
  const directSupportedFaceSet = new Set(
    requestedGrid.supportedDirectFaceAmounts ?? [],
  );
  const ageBounds = getEffectiveProductAgeBounds(
    product,
    snapshot.globalAges.length > 0 ? snapshot.globalAges : globalDefaults.ages,
  );
  const faceBounds = getEffectiveProductFaceBounds(
    product,
    snapshot.globalFaceAmounts.length > 0
      ? snapshot.globalFaceAmounts
      : globalDefaults.faceAmounts,
  );
  const targetEntries = [];
  const seen = new Set();
  const missingCountsByGroup = [];

  for (const group of groups) {
    const groupKey = [
      String(group.termYears),
      String(group.gender).toLowerCase(),
      String(group.tobaccoClass).toLowerCase(),
    ].join("|");
    const facesByAge = actualFacesByGroupAge.get(groupKey) ?? new Map();
    const supportedAgeSet = new Set(group.supportedAges);
    const supportedFaceSet = new Set(group.supportedFaceAmounts);
    const candidateAges =
      requestedGrid.ageSnapMode === "supported" && group.supportedAges.length > 0
        ? requestedGrid.ages.filter((age) => group.supportedAges.includes(age))
        : requestedGrid.ages;
    let missingCount = 0;

    for (const age of candidateAges) {
      if (age < ageBounds.minAge || age > ageBounds.maxAge) {
        continue;
      }

      const maxFaceForAge = getMaxFaceForAge(product, age, group.termYears);
      if (Number.isNaN(maxFaceForAge) || maxFaceForAge <= 0) {
        continue;
      }

      const ageSpecificFaceAmounts = uniqueSortedNumbers([
        ...(facesByAge.get(age) ?? []),
      ]);
      const ageSpecificFaceSet = new Set(ageSpecificFaceAmounts);
      const candidateFaceAmounts =
        missingMode === "combo" && ageSpecificFaceAmounts.length > 0
          ? requestedGrid.faceAmounts.filter((faceAmount) =>
              ageSpecificFaceAmounts.includes(faceAmount),
            )
          : requestedGrid.faceSnapMode === "supported" &&
              group.supportedFaceAmounts.length > 0
            ? requestedGrid.faceAmounts.filter((faceAmount) =>
                group.supportedFaceAmounts.includes(faceAmount),
              )
            : requestedGrid.faceAmounts;

      for (const faceAmount of candidateFaceAmounts) {
        if (faceAmount < faceBounds.minFaceAmount || faceAmount > faceBounds.maxFaceAmount) {
          continue;
        }
        if (faceAmount > maxFaceForAge) {
          continue;
        }

        const key = comboKey({
          termYears: group.termYears,
          gender: group.gender,
          tobaccoClass: group.tobaccoClass,
          age,
          faceAmount,
        });
        if (seen.has(key)) {
          continue;
        }

        const actual = actualHealthClassesByCombo.get(key);
        if (
          comboIsAlreadyCovered({
            actual,
            expectedHealthClasses: group.expectedHealthClasses,
            missingMode,
          })
        ) {
          continue;
        }

        seen.add(key);
        const actualClassCount = actual?.size ?? 0;
        const priority =
          actualClassCount > 0
            ? 0
            : supportedAgeSet.has(age) && supportedFaceSet.has(faceAmount)
              ? 1
              : directSupportedAgeSet.has(age) && directSupportedFaceSet.has(faceAmount)
                ? 2
                : supportedAgeSet.has(age) && ageSpecificFaceSet.has(faceAmount)
                  ? 3
                  : directSupportedAgeSet.has(age)
                    ? 4
                    : directSupportedFaceSet.has(faceAmount)
                      ? 5
                      : 6;

        targetEntries.push({
          priority,
          actualClassCount,
          target: {
            sex: toTitleCase(group.gender),
            tobacco: normalizeTobaccoLabel(group.tobaccoClass),
            term: String(group.termYears),
            age,
            faceAmount,
          },
        });
        missingCount += 1;
      }
    }

    missingCountsByGroup.push({
      termYears: group.termYears,
      gender: group.gender,
      tobaccoClass: group.tobaccoClass,
      expectedHealthClasses: group.expectedHealthClasses,
      missingCombos: missingCount,
    });
  }

  sortTargetEntries(targetEntries);
  const targets = targetEntries.map((entry) => entry.target);

  return {
    targets,
    summary: {
      expectedGroupCount: groups.length,
      missingCountsByGroup,
    },
  };
}

function generateMissingTargets({
  product,
  snapshot,
  ageScope,
  faceScope,
  missingMode,
}) {
  const actualHealthClassesByCombo = buildActualHealthClassesByCombo(snapshot);

  const missingTargets = [];
  const missingCountsByGroup = [];

  for (const group of snapshot.groups) {
    const expectedHealthClasses = [...new Set(group.expected_health_classes ?? [])].sort();
    const termYears = Number(group.term_years);
    const gender = String(group.gender).toLowerCase();
    const tobaccoClass = String(group.tobacco_class).toLowerCase();

    const candidateAges =
      ageScope === "group"
        ? uniqueSortedNumbers(group.ages ?? [])
        : snapshot.globalAges;
    const candidateFaceAmounts =
      faceScope === "group"
        ? uniqueSortedNumbers(group.face_amounts ?? [])
        : snapshot.globalFaceAmounts;

    let missingCount = 0;

    for (const age of candidateAges) {
      if (Number.isFinite(Number(product.minAge)) && age < Number(product.minAge)) {
        continue;
      }
      if (Number.isFinite(Number(product.maxAge)) && age > Number(product.maxAge)) {
        continue;
      }

      const maxFaceForAge = getMaxFaceForAge(product, age, termYears);
      for (const faceAmount of candidateFaceAmounts) {
        if (
          Number.isFinite(Number(product.minFaceAmount)) &&
          faceAmount < Number(product.minFaceAmount)
        ) {
          continue;
        }
        if (
          Number.isFinite(Number(product.maxFaceAmount)) &&
          faceAmount > Number(product.maxFaceAmount)
        ) {
          continue;
        }
        if (faceAmount > maxFaceForAge) {
          continue;
        }

        const actual = actualHealthClassesByCombo.get(
          comboKey({ termYears, gender, tobaccoClass, age, faceAmount }),
        );

        if (
          comboIsAlreadyCovered({
            actual,
            expectedHealthClasses,
            missingMode,
          })
        ) {
          continue;
        }

        missingTargets.push({
          sex: toTitleCase(gender),
          tobacco: normalizeTobaccoLabel(tobaccoClass),
          term: String(termYears),
          age,
          faceAmount,
        });
        missingCount += 1;
      }
    }

    missingCountsByGroup.push({
      termYears,
      gender,
      tobaccoClass,
      expectedHealthClasses,
      missingCombos: missingCount,
    });
  }

  sortTargets(missingTargets);

  return {
    targets: missingTargets,
    summary: {
      expectedGroupCount: snapshot.groups.length,
      missingCountsByGroup,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const carrierName = normalizeCarrierName(args.carrier);
  const productName = String(args.product || "").trim();
  const state = String(args.state || "IL").trim().toUpperCase();
  const ageScope = String(args["age-scope"] || "product").trim().toLowerCase();
  const faceScope = String(args["face-scope"] || "product").trim().toLowerCase();
  const gridMode = String(args["grid-mode"] || "metadata").trim().toLowerCase();
  const missingMode = String(args["missing-mode"] || "combo").trim().toLowerCase();
  const format = String(args.format || "browser").trim().toLowerCase();
  const chunkSize = parseOptionalPositiveInteger(args["chunk-size"], "--chunk-size");
  const chunkNumber = parseOptionalPositiveInteger(args["chunk-number"], "--chunk-number");
  const limit = parseOptionalPositiveInteger(args.limit, "--limit");
  const offset = parseOptionalInteger(args.offset, "--offset") ?? 0;

  if (!carrierName || !productName) {
    printUsage();
    process.exit(1);
  }
  if (isManualOnlyTermProduct(carrierName, productName)) {
    throw new Error(
      `carrier="${carrierName}" product="${productName}" is marked manual-only and is intentionally excluded from Insurance Toolkits term fetch requests.`,
    );
  }

  if (!VALID_SCOPES.has(ageScope)) {
    throw new Error(`Invalid --age-scope "${ageScope}". Use product or group.`);
  }
  if (!VALID_SCOPES.has(faceScope)) {
    throw new Error(`Invalid --face-scope "${faceScope}". Use product or group.`);
  }
  if (!VALID_GRID_MODES.has(gridMode)) {
    throw new Error(`Invalid --grid-mode "${gridMode}". Use metadata, matrix, or explicit.`);
  }
  if (!VALID_MISSING_MODES.has(missingMode)) {
    throw new Error(`Invalid --missing-mode "${missingMode}". Use combo or class.`);
  }
  if (!VALID_FORMATS.has(format)) {
    throw new Error(`Invalid --format "${format}". Use browser, json, or summary.`);
  }
  if (chunkSize !== null && limit !== null) {
    throw new Error("Use either --chunk-size/--chunk-number or --limit/--offset, not both.");
  }
  if (offset < 0) {
    throw new Error(`Invalid --offset "${offset}". Expected zero or greater.`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const product = await resolveProduct(client, {
      carrierName,
      productName,
      imoId: args["imo-id"] || null,
    });
    const snapshot = await loadMatrixSnapshot(client, product);
    const globalDefaults = await loadBootstrapDefaults(client, product.carrierName);
    const bootstrapEmpty = Boolean(args["bootstrap-empty"]);
    const requestedGrid = buildRequestedGrid({
      args,
      product,
      snapshot,
      globalDefaults,
    });

    let generated;
    let strategy;
    if (snapshot.groups.length === 0) {
      if (!bootstrapEmpty) {
        throw new Error(
          `No premium_matrix rows found for carrier="${carrierName}" product="${productName}". Re-run with --bootstrap-empty to seed targets from the shared term grid.`,
        );
      }

      generated = generateExplicitGridTargets({
        product,
        snapshot,
        globalDefaults,
        missingMode,
        requestedGrid: requestedGrid ?? {
          ages: globalDefaults.ages,
          requestedAges: globalDefaults.ages,
          supportedDirectAges: globalDefaults.ages,
          skippedUnsupportedAges: [],
          faceAmounts: globalDefaults.faceAmounts,
          requestedFaceAmounts: globalDefaults.faceAmounts,
          supportedDirectFaceAmounts: globalDefaults.faceAmounts,
          skippedUnsupportedFaceAmounts: [],
          ageMin: globalDefaults.ages[0] ?? null,
          ageMax: globalDefaults.ages[globalDefaults.ages.length - 1] ?? null,
          ageStep: inferMinimumIncrement(globalDefaults.ages) ?? 1,
          faceMin: globalDefaults.faceAmounts[0] ?? null,
          faceMax: globalDefaults.faceAmounts[globalDefaults.faceAmounts.length - 1] ?? null,
          faceStep: inferMinimumIncrement(globalDefaults.faceAmounts) ?? 1000,
          ageSnapMode: "supported",
          faceSnapMode: "supported",
        },
      });
      strategy = "bootstrap-empty";
    } else if (gridMode === "matrix") {
      generated = generateMissingTargets({
        product,
        snapshot,
        ageScope,
        faceScope,
        missingMode,
      });
      strategy = "matrix-diff";
    } else if (gridMode === "explicit" || requestedGrid) {
      generated = generateExplicitGridTargets({
        product,
        snapshot,
        globalDefaults,
        missingMode,
        requestedGrid:
          requestedGrid ??
          (() => {
            throw new Error(
              "grid-mode=explicit requires an explicit age/face grid. Provide --age-min/--age-max/--age-step and --face-min/--face-max/--face-step, or use --ages/--face-values.",
            );
          })(),
      });
      strategy = "explicit-grid";
    } else {
      generated = generateMetadataGridTargets({
        product,
        snapshot,
        globalDefaults,
        missingMode,
      });
      strategy = "metadata-grid";
    }

    const sliced = sliceTargets(generated.targets, {
      chunkSize,
      chunkNumber,
      limit,
      offset,
    });

    const result = {
      carrierName,
      productName,
      state,
      ageScope,
      faceScope,
      strategy,
      missingMode,
      generatedAt: new Date().toISOString(),
      requestedGrid,
      selection: sliced.selection,
      product,
      summary: {
        expectedGroupCount: generated.summary.expectedGroupCount,
        missingTargetCount: sliced.selection.returnedTargets,
        totalMissingTargetCount: sliced.selection.totalTargets,
        matrixAgeCount: snapshot.globalAges.length,
        matrixFaceAmountCount: snapshot.globalFaceAmounts.length,
        bootstrapAgeCount: globalDefaults.ages.length,
        bootstrapFaceAmountCount: globalDefaults.faceAmounts.length,
        requestedAgeCount: requestedGrid?.requestedAges?.length ?? null,
        effectiveAgeCount: requestedGrid?.ages?.length ?? null,
        skippedUnsupportedAgeCount:
          requestedGrid?.skippedUnsupportedAges?.length ?? null,
        requestedFaceAmountCount: requestedGrid?.requestedFaceAmounts?.length ?? null,
        effectiveFaceAmountCount: requestedGrid?.faceAmounts?.length ?? null,
        skippedUnsupportedFaceAmountCount:
          requestedGrid?.skippedUnsupportedFaceAmounts?.length ?? null,
        offset: sliced.selection.offset,
        limit: sliced.selection.limit,
        chunkSize: sliced.selection.chunkSize,
        chunkNumber: sliced.selection.chunkNumber,
        totalChunks: sliced.selection.totalChunks,
        missingCountsByGroup: generated.summary.missingCountsByGroup,
      },
      targets: sliced.targets,
    };

    if (format === "summary") {
      console.log(
        JSON.stringify(
          {
            product: {
              carrierName: result.product.carrierName,
            productName: result.product.productName,
            productId: result.product.productId,
            imoId: result.product.imoId,
            strategy: result.strategy,
            requestedGrid: result.requestedGrid,
          },
          summary: result.summary,
        },
          null,
          2,
        ),
      );
      return;
    }

    if (format === "json") {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(buildBrowserSnippet(result));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
