// scripts/extract-uw-guide-pdf.mjs
// Extracts text from a UW guide PDF using pdfjs-dist (already a project dep).
// Usage:
//   node scripts/extract-uw-guide-pdf.mjs "/path/to/guide.pdf"
//
// Writes parsed text to scripts/output/<basename>.txt for downstream module
// generation (manual review + migration authoring).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function extractText(pdfPath) {
  const data = new Uint8Array(readFileSync(pdfPath));
  // pdfjs-dist legacy build is the Node-friendly entry point.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(`\n\n===== PAGE ${i} =====\n${pageText}`);
  }
  return { totalPages, text: pages.join("\n") };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node scripts/extract-uw-guide-pdf.mjs <pdf-path>");
    process.exit(1);
  }
  const abs = resolve(inputPath);
  const outDir = join(__dirname, "output");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, basename(abs, ".pdf") + ".txt");
  console.log(`Extracting: ${abs}`);
  const { totalPages, text } = await extractText(abs);
  writeFileSync(outFile, text, "utf8");
  console.log(`Pages: ${totalPages}`);
  console.log(`Bytes: ${text.length}`);
  console.log(`Output: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
