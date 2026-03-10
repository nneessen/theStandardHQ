// src/features/underwriting/utils/buildTableCsvParser.ts

import type {
  BuildTableData,
  BuildTableRow,
  BuildTableWeightRanges,
  RatingClassKey,
} from "../../types/build-table.types";
import {
  generateHeightOptions,
  inchesToHeightDisplay,
  ALL_RATING_CLASSES,
} from "../../types/build-table.types";

/**
 * Result of parsing a CSV file
 */
export interface CsvParseResult {
  success: boolean;
  data?: BuildTableData;
  errors?: string[];
  warnings?: string[];
}

/**
 * Parses a height string like "5'10"" or "5'10" to total inches
 * Supports formats: 5'10", 5'10, 5-10, 510 (5 feet 10 inches)
 */
export function parseHeightString(heightStr: string): number | null {
  const cleaned = heightStr.trim();

  // Format: 5'10" or 5'10
  const apostropheMatch = cleaned.match(/^(\d+)'(\d+)"?$/);
  if (apostropheMatch) {
    const feet = parseInt(apostropheMatch[1], 10);
    const inches = parseInt(apostropheMatch[2], 10);
    if (feet >= 0 && inches >= 0 && inches < 12) {
      return feet * 12 + inches;
    }
  }

  // Format: 5-10
  const dashMatch = cleaned.match(/^(\d+)-(\d+)$/);
  if (dashMatch) {
    const feet = parseInt(dashMatch[1], 10);
    const inches = parseInt(dashMatch[2], 10);
    if (feet >= 0 && inches >= 0 && inches < 12) {
      return feet * 12 + inches;
    }
  }

  // Format: just inches (e.g., 70)
  const pureInches = parseInt(cleaned, 10);
  if (!isNaN(pureInches) && pureInches >= 48 && pureInches <= 96) {
    return pureInches;
  }

  return null;
}

/**
 * Formats total inches to "5'10"" format for CSV export
 */
export function formatHeightForCsv(totalInches: number): string {
  const display = inchesToHeightDisplay(totalInches);
  return `${display.feet}'${display.inchesRemainder}"`;
}

/**
 * Parses a weight value from CSV, returns undefined if empty/invalid
 */
function parseWeightValue(value: string): number | undefined {
  const cleaned = value.trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "—") {
    return undefined;
  }
  const num = parseInt(cleaned, 10);
  if (isNaN(num) || num < 0 || num > 999) {
    return undefined;
  }
  return num;
}

/**
 * Normalizes header names to expected format
 */
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/['"]/g, "")
    .replace(/pref\+|pref_plus|preferredplus/g, "preferred_plus")
    .replace(/std\+|std_plus|standardplus/g, "standard_plus")
    .replace(/tbl_?([a-p])|table_?([a-p])/g, (_, a, b) => `table_${a || b}`);
}

/**
 * Parses a CSV line handling quoted fields that may contain commas.
 * Supports double-quote escaping (e.g., "5'10""" for 5'10")
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ",") {
        // End of field
        result.push(current);
        current = "";
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current);

  return result;
}

/**
 * Parses CSV content into BuildTableData
 *
 * @param csvContent - Raw CSV string
 * @returns Parse result with data or errors
 *
 * @example
 * const result = parseBuildTableCsv(`
 * height,preferred_plus,preferred,standard_plus,standard
 * 4'10",119,132,145,174
 * 4'11",124,137,151,181
 * `);
 */
export function parseBuildTableCsv(csvContent: string): CsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows: BuildTableRow[] = [];

  // Split into lines, handle both \r\n and \n
  const lines = csvContent
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return {
      success: false,
      errors: ["CSV must have a header row and at least one data row"],
    };
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map(normalizeHeader);

  // Validate headers
  const heightIndex = headers.indexOf("height");
  if (heightIndex === -1) {
    return {
      success: false,
      errors: ['CSV must have a "height" column'],
    };
  }

  // Find weight column indices
  const columnMap: Record<string, number> = {
    preferred_plus: headers.indexOf("preferred_plus"),
    preferred: headers.indexOf("preferred"),
    standard_plus: headers.indexOf("standard_plus"),
    standard: headers.indexOf("standard"),
    table_a: headers.indexOf("table_a"),
    table_b: headers.indexOf("table_b"),
    table_c: headers.indexOf("table_c"),
    table_d: headers.indexOf("table_d"),
    table_e: headers.indexOf("table_e"),
    table_f: headers.indexOf("table_f"),
    table_g: headers.indexOf("table_g"),
    table_h: headers.indexOf("table_h"),
    table_i: headers.indexOf("table_i"),
    table_j: headers.indexOf("table_j"),
    table_k: headers.indexOf("table_k"),
    table_l: headers.indexOf("table_l"),
    table_m: headers.indexOf("table_m"),
    table_n: headers.indexOf("table_n"),
    table_o: headers.indexOf("table_o"),
    table_p: headers.indexOf("table_p"),
  };

  // Check if at least one weight column exists
  const hasAnyWeightColumn = Object.values(columnMap).some((idx) => idx !== -1);
  if (!hasAnyWeightColumn) {
    return {
      success: false,
      errors: [
        "CSV must have at least one weight column (preferred_plus, preferred, standard_plus, standard, or table_a through table_p)",
      ],
    };
  }

  // Track which heights we've seen
  const seenHeights = new Set<number>();

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    const values = parseCsvLine(line);
    const lineNum = i + 1;

    // Get height
    const heightValue = values[heightIndex]?.trim() || "";
    const heightInches = parseHeightString(heightValue);

    if (heightInches === null) {
      errors.push(`Row ${lineNum}: Invalid height "${heightValue}"`);
      continue;
    }

    // Check for duplicate heights
    if (seenHeights.has(heightInches)) {
      warnings.push(
        `Row ${lineNum}: Duplicate height ${formatHeightForCsv(heightInches)}, using later value`,
      );
      // Remove previous entry
      const existingIndex = rows.findIndex(
        (r) => r.heightInches === heightInches,
      );
      if (existingIndex !== -1) {
        rows.splice(existingIndex, 1);
      }
    }
    seenHeights.add(heightInches);

    // Parse weight values into ranges (CSV imports as max-only for simplicity)
    const weightRanges: BuildTableWeightRanges = {};

    if (columnMap.preferred_plus !== -1) {
      const val = values[columnMap.preferred_plus] || "";
      const maxVal = parseWeightValue(val);
      if (maxVal !== undefined) {
        weightRanges.preferredPlus = { max: maxVal };
      }
    }
    if (columnMap.preferred !== -1) {
      const val = values[columnMap.preferred] || "";
      const maxVal = parseWeightValue(val);
      if (maxVal !== undefined) {
        weightRanges.preferred = { max: maxVal };
      }
    }
    if (columnMap.standard_plus !== -1) {
      const val = values[columnMap.standard_plus] || "";
      const maxVal = parseWeightValue(val);
      if (maxVal !== undefined) {
        weightRanges.standardPlus = { max: maxVal };
      }
    }
    if (columnMap.standard !== -1) {
      const val = values[columnMap.standard] || "";
      const maxVal = parseWeightValue(val);
      if (maxVal !== undefined) {
        weightRanges.standard = { max: maxVal };
      }
    }

    // Parse table rating columns (A through P)
    const tableRatingCsvKeys = [
      { csv: "table_a", prop: "tableA" as const },
      { csv: "table_b", prop: "tableB" as const },
      { csv: "table_c", prop: "tableC" as const },
      { csv: "table_d", prop: "tableD" as const },
      { csv: "table_e", prop: "tableE" as const },
      { csv: "table_f", prop: "tableF" as const },
      { csv: "table_g", prop: "tableG" as const },
      { csv: "table_h", prop: "tableH" as const },
      { csv: "table_i", prop: "tableI" as const },
      { csv: "table_j", prop: "tableJ" as const },
      { csv: "table_k", prop: "tableK" as const },
      { csv: "table_l", prop: "tableL" as const },
      { csv: "table_m", prop: "tableM" as const },
      { csv: "table_n", prop: "tableN" as const },
      { csv: "table_o", prop: "tableO" as const },
      { csv: "table_p", prop: "tableP" as const },
    ];
    for (const { csv, prop } of tableRatingCsvKeys) {
      if (columnMap[csv] !== -1) {
        const val = values[columnMap[csv]] || "";
        const maxVal = parseWeightValue(val);
        if (maxVal !== undefined) {
          weightRanges[prop] = { max: maxVal };
        }
      }
    }

    // Only add row if it has at least one weight value
    const hasAnyWeight = Object.keys(weightRanges).length > 0;

    if (!hasAnyWeight) {
      warnings.push(
        `Row ${lineNum}: No valid weight values for ${formatHeightForCsv(heightInches)}`,
      );
      continue;
    }

    rows.push({
      heightInches,
      weightRanges,
    });
  }

  if (rows.length === 0) {
    return {
      success: false,
      errors: [...errors, "No valid data rows found"],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Sort by height
  rows.sort((a, b) => a.heightInches - b.heightInches);

  return {
    success: true,
    data: rows,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Maps rating class keys to their CSV column names
 */
const CLASS_KEY_TO_CSV: Record<RatingClassKey, string> = {
  preferredPlus: "preferred_plus",
  preferred: "preferred",
  standardPlus: "standard_plus",
  standard: "standard",
  tableA: "table_a",
  tableB: "table_b",
  tableC: "table_c",
  tableD: "table_d",
  tableE: "table_e",
  tableF: "table_f",
  tableG: "table_g",
  tableH: "table_h",
  tableI: "table_i",
  tableJ: "table_j",
  tableK: "table_k",
  tableL: "table_l",
  tableM: "table_m",
  tableN: "table_n",
  tableO: "table_o",
  tableP: "table_p",
};

/**
 * Exports BuildTableData to CSV string
 * Note: Exports max values only (min values are not included in CSV format)
 *
 * @param data - Build table data to export
 * @param activeClasses - Optional array of rating class keys to include (defaults to all)
 * @returns CSV string
 */
export function exportBuildTableToCsv(
  data: BuildTableData,
  activeClasses?: RatingClassKey[],
): string {
  // Default to all classes if not specified
  const classesToExport = activeClasses?.length
    ? ALL_RATING_CLASSES.filter((rc) => activeClasses.includes(rc.key))
    : ALL_RATING_CLASSES;

  const lines: string[] = [];

  // Header
  const headerParts = [
    "height",
    ...classesToExport.map((rc) => CLASS_KEY_TO_CSV[rc.key]),
  ];
  lines.push(headerParts.join(","));

  // Data rows
  for (const row of data) {
    const height = formatHeightForCsv(row.heightInches);
    const values = classesToExport.map((rc) => {
      const range = row.weightRanges[rc.key];
      return range?.max !== undefined ? range.max.toString() : "";
    });

    lines.push(`${height},${values.join(",")}`);
  }

  return lines.join("\n");
}

/**
 * Generates a CSV template with all heights and empty values
 *
 * @param activeClasses - Optional array of rating class keys to include (defaults to all)
 * @returns CSV template string
 */
export function generateCsvTemplate(activeClasses?: RatingClassKey[]): string {
  // Default to all classes if not specified
  const classesToInclude = activeClasses?.length
    ? ALL_RATING_CLASSES.filter((rc) => activeClasses.includes(rc.key))
    : ALL_RATING_CLASSES;

  const lines: string[] = [];

  // Header
  const headerParts = [
    "height",
    ...classesToInclude.map((rc) => CLASS_KEY_TO_CSV[rc.key]),
  ];
  lines.push(headerParts.join(","));

  // Generate rows for all heights with empty values
  const heights = generateHeightOptions();
  const emptyValues = classesToInclude.map(() => "").join(",");

  for (const height of heights) {
    lines.push(`${height.formatted},${emptyValues}`);
  }

  return lines.join("\n");
}

/**
 * Triggers a download of a CSV file in the browser
 *
 * @param content - CSV string content
 * @param filename - Name for the downloaded file
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
