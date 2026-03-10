#!/usr/bin/env node

import "dotenv/config";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const VALID_FORMATS = new Set(["summary", "json"]);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const NON_TOOLKIT_TERM_PRODUCTS = new Set([
  "Baltimore Life|aPriority Level Term",
  "Foresters Financial|Your Term Medical",
  "Legal & General|Term",
  "Mutual of Omaha|Term Life Answers",
  "SBLI|Term",
]);

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
  node scripts/audit-term-fetch-coverage.mjs [--format summary|json]

What it does:
  - lists all term_life products
  - reports current premium_matrix row counts
  - runs the target generator for products that already have matrix rows
  - flags zero-row products that require --bootstrap-empty or manual entry
`);
}

function summarizeStatus(product) {
  if (product.matrixRows === 0 && !product.inToolkit) return "manual";
  if (product.matrixRows === 0) return "empty";
  if (product.missingTargetCount > 0) return "partial";
  return "complete";
}

function formatCommand(product) {
  const args = [
    "node scripts/generate-term-fetch-targets.mjs",
    `--carrier ${JSON.stringify(product.carrierName)}`,
    `--product ${JSON.stringify(product.productName)}`,
  ];

  if (product.imoId) {
    args.push(`--imo-id ${product.imoId}`);
  }

  if (product.matrixRows === 0) {
    args.push("--bootstrap-empty");
  }

  return args.join(" ");
}

async function loadTermProducts(client) {
  const { rows } = await client.query(`
    select
      c.name as carrier_name,
      p.name as product_name,
      p.id,
      p.imo_id,
      count(pm.*) as matrix_rows
    from products p
    join carriers c
      on c.id = p.carrier_id
    left join premium_matrix pm
      on pm.product_id = p.id
     and pm.imo_id = p.imo_id
    where p.product_type = 'term_life'
    group by c.name, p.name, p.id, p.imo_id
    order by c.name, p.name
  `);

  return rows.map((row) => ({
    carrierName: row.carrier_name,
    productName: row.product_name,
    productId: row.id,
    imoId: row.imo_id,
    matrixRows: Number(row.matrix_rows),
    inToolkit: !NON_TOOLKIT_TERM_PRODUCTS.has(`${row.carrier_name}|${row.product_name}`),
  }));
}

function loadGeneratorSummary(product) {
  const output = execFileSync(
    "node",
    [
      "scripts/generate-term-fetch-targets.mjs",
      "--carrier",
      product.carrierName,
      "--product",
      product.productName,
      "--imo-id",
      product.imoId,
      "--format",
      "summary",
    ],
    {
      cwd: REPO_ROOT,
      env: process.env,
      encoding: "utf8",
    },
  );

  return JSON.parse(output);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const format = String(args.format || "summary").trim().toLowerCase();
  if (!VALID_FORMATS.has(format)) {
    throw new Error(`Invalid --format "${format}". Use summary or json.`);
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
    const products = await loadTermProducts(client);
    const results = products.map((product) => {
      if (product.matrixRows === 0) {
        return {
          ...product,
          strategy: "bootstrap-empty",
          missingTargetCount: null,
          status: summarizeStatus(product),
          recommendedCommand: formatCommand(product),
        };
      }

      const summary = loadGeneratorSummary(product);
      return {
        ...product,
        strategy: summary.product.strategy,
        missingTargetCount: summary.summary.missingTargetCount,
        status: summarizeStatus({
          matrixRows: product.matrixRows,
          missingTargetCount: summary.summary.missingTargetCount,
        }),
        recommendedCommand: formatCommand(product),
      };
    });

    if (format === "json") {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    const complete = results.filter((result) => result.status === "complete");
    const partial = results.filter((result) => result.status === "partial");
    const empty = results.filter((result) => result.status === "empty");
    const manual = results.filter((result) => result.status === "manual");

    console.log("Term Fetch Coverage Audit\n");
    console.log(`Complete: ${complete.length}`);
    console.log(`Partial: ${partial.length}`);
    console.log(`Empty: ${empty.length}\n`);
    console.log(`Manual/Other Source: ${manual.length}\n`);

    if (partial.length > 0) {
      console.log("Partial products:");
      for (const product of partial) {
        console.log(
          `- ${product.carrierName} / ${product.productName}: ${product.missingTargetCount} missing combo(s)`,
        );
        console.log(`  ${product.recommendedCommand}`);
      }
      console.log("");
    }

    if (empty.length > 0) {
      console.log("Empty products:");
      for (const product of empty) {
        console.log(
          `- ${product.carrierName} / ${product.productName}: 0 premium_matrix rows`,
        );
        console.log(`  ${product.recommendedCommand}`);
      }
      console.log("");
    }

    if (manual.length > 0) {
      console.log("Manual or non-Toolkit products:");
      for (const product of manual) {
        console.log(
          `- ${product.carrierName} / ${product.productName}: not available in the Insurance Toolkits term quoter`,
        );
      }
      console.log("");
    }

    if (complete.length > 0) {
      console.log("Complete products:");
      for (const product of complete) {
        console.log(
          `- ${product.carrierName} / ${product.productName}: ${product.matrixRows} row(s), no missing request combos`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
