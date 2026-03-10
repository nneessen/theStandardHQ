#!/usr/bin/env node

import "dotenv/config";
import { Client } from "pg";

const VALID_SCOPES = new Set(["product", "group"]);
const VALID_FORMATS = new Set(["browser", "json", "summary"]);
const VALID_GRID_MODES = new Set(["metadata", "matrix"]);

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
    [--grid-mode metadata|matrix] \\
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
  Use --bootstrap-empty when the product has zero premium_matrix rows and you want to
  seed requests from the shared term grid plus the product's underwriting metadata.
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

function buildBrowserSnippet(result) {
  const summaryComments = [
    `// ${result.product.carrierName} / ${result.product.productName}`,
    `// productId=${result.product.productId} imoId=${result.product.imoId}`,
    `// targetCombos=${result.targets.length} strategy=${result.strategy} ageScope=${result.ageScope} faceScope=${result.faceScope}`,
  ];

  if (result.strategy === "bootstrap-empty") {
    summaryComments.push(
      "// bootstrap-empty=true (product has no premium_matrix rows; targets inferred from shared term grid + product metadata)",
    );
  }

  if (result.targets.length === 0) {
    return `${summaryComments.join("\n")}\nconsole.log(${JSON.stringify(
      `No missing premium_matrix request combinations were found for ${result.product.carrierName} / ${result.product.productName}.`,
    )});`;
  }

  const metadata = {
    label: `${result.product.carrierName} / ${result.product.productName} / missing premium_matrix combos`,
    carrierName: result.product.carrierName,
    productName: result.product.productName,
    state: result.state,
    stateStorageKey: `__termFetcherState_dynamic_${sanitizeStorageKey(
      `${result.product.carrierName}_${result.product.productName}_${result.state}`,
    )}`,
    generatedAt: result.generatedAt,
    source: {
      productId: result.product.productId,
      imoId: result.product.imoId,
      ageScope: result.ageScope,
      faceScope: result.faceScope,
      expectedGroupCount: result.summary.expectedGroupCount,
      totalTargets: result.targets.length,
      strategy: result.strategy,
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
  const query = `
    select
      array_agg(distinct age order by age) as ages,
      array_agg(distinct face_amount order by face_amount) as face_amounts,
      array_agg(distinct term_years order by term_years) as term_years,
      array_agg(distinct gender order by gender) as genders,
      array_agg(distinct tobacco_class order by tobacco_class) as tobacco_classes
    from premium_matrix
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

  const { rows } = await client.query(query, [carrierName]);
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

function generateMetadataGridTargets({ product, snapshot, globalDefaults }) {
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
        const hasAnyActualRows = Boolean(actual?.size);
        const isMissingExpectedHealthClass =
          expectedHealthClasses.length > 0 &&
          expectedHealthClasses.some((healthClass) => !actual?.has(healthClass));

        if (hasAnyActualRows && !isMissingExpectedHealthClass) {
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

  targets.sort((left, right) => {
    return (
      left.term.localeCompare(right.term, undefined, { numeric: true }) ||
      left.sex.localeCompare(right.sex) ||
      left.tobacco.localeCompare(right.tobacco) ||
      left.age - right.age ||
      left.faceAmount - right.faceAmount
    );
  });

  return {
    targets,
    summary: {
      expectedGroupCount: snapshot.groups.length,
      missingCountsByGroup,
    },
  };
}

function generateMissingTargets({
  product,
  snapshot,
  ageScope,
  faceScope,
}) {
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

        const missingHealthClasses = expectedHealthClasses.filter(
          (healthClass) => !actual?.has(healthClass),
        );

        if (missingHealthClasses.length === 0) {
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

  missingTargets.sort((left, right) => {
    return (
      left.term.localeCompare(right.term, undefined, { numeric: true }) ||
      left.sex.localeCompare(right.sex) ||
      left.tobacco.localeCompare(right.tobacco) ||
      left.age - right.age ||
      left.faceAmount - right.faceAmount
    );
  });

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
  const format = String(args.format || "browser").trim().toLowerCase();

  if (!carrierName || !productName) {
    printUsage();
    process.exit(1);
  }

  if (!VALID_SCOPES.has(ageScope)) {
    throw new Error(`Invalid --age-scope "${ageScope}". Use product or group.`);
  }
  if (!VALID_SCOPES.has(faceScope)) {
    throw new Error(`Invalid --face-scope "${faceScope}". Use product or group.`);
  }
  if (!VALID_GRID_MODES.has(gridMode)) {
    throw new Error(`Invalid --grid-mode "${gridMode}". Use metadata or matrix.`);
  }
  if (!VALID_FORMATS.has(format)) {
    throw new Error(`Invalid --format "${format}". Use browser, json, or summary.`);
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

	    let generated;
	    let strategy;
	    if (snapshot.groups.length === 0) {
	      if (!bootstrapEmpty) {
	        throw new Error(
	          `No premium_matrix rows found for carrier="${carrierName}" product="${productName}". Re-run with --bootstrap-empty to seed targets from the shared term grid.`,
	        );
	      }

	      generated = generateMetadataGridTargets({
	        product,
	        snapshot,
	        globalDefaults,
	      });
	      strategy = "bootstrap-empty";
	    } else if (gridMode === "matrix") {
	      generated = generateMissingTargets({
	        product,
	        snapshot,
	        ageScope,
	        faceScope,
	      });
	      strategy = "matrix-diff";
	    } else {
	      generated = generateMetadataGridTargets({
	        product,
	        snapshot,
	        globalDefaults,
	      });
	      strategy = "metadata-grid";
	    }

    const result = {
      carrierName,
      productName,
      state,
      ageScope,
      faceScope,
      strategy,
      generatedAt: new Date().toISOString(),
      product,
      summary: {
        expectedGroupCount: generated.summary.expectedGroupCount,
        missingTargetCount: generated.targets.length,
        matrixAgeCount: snapshot.globalAges.length,
        matrixFaceAmountCount: snapshot.globalFaceAmounts.length,
        bootstrapAgeCount: globalDefaults.ages.length,
        bootstrapFaceAmountCount: globalDefaults.faceAmounts.length,
        missingCountsByGroup: generated.summary.missingCountsByGroup,
      },
      targets: generated.targets,
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
