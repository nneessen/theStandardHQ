// src/utils/exportHelpers.ts

import { format } from "date-fns";

/** Exportable data value types */
type ExportableValue = string | number | boolean | Date | null | undefined;

/** Input record type - accepts unknown values that are handled during conversion */
type InputRecord = Record<string, unknown>;

/**
 * Convert data to CSV format
 */

export function convertToCSV(data: InputRecord[], headers?: string[]): string {
  if (data.length === 0) return "";

  // Use provided headers or extract from first object
  const keys = headers || Object.keys(data[0]);

  // Create header row
  const headerRow = keys.join(",");

  // Create data rows
  const dataRows = data.map((row) => {
    return keys
      .map((key) => {
        const value = row[key] as ExportableValue;

        // Handle different value types
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && value.includes(",")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        if (value instanceof Date) {
          return format(value, "yyyy-MM-dd");
        }

        return value.toString();
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download CSV file
 */

export function downloadCSV(
  data: InputRecord[],
  filename: string,
  headers?: string[],
): void {
  const csv = convertToCSV(data, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Copy data to clipboard as CSV
 */

export async function copyToClipboardAsCSV(
  data: InputRecord[],
  headers?: string[],
): Promise<boolean> {
  try {
    const csv = convertToCSV(data, headers);
    await navigator.clipboard.writeText(csv);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Export analytics section data
 */
export interface AnalyticsSectionExport {
  sectionName: string;
  data: InputRecord[];
  headers?: string[];
}

/**
 * Download multiple analytics sections as separate CSV files
 */
export function downloadAnalyticsSections(
  sections: AnalyticsSectionExport[],
): void {
  sections.forEach((section) => {
    downloadCSV(section.data, section.sectionName, section.headers);
  });
}

/**
 * Format analytics metrics for export
 */

export function formatMetricsForExport(
  metrics: Record<string, unknown>,
): Record<string, ExportableValue | string> {
  const formatted: Record<string, ExportableValue | string> = {};

  for (const [key, value] of Object.entries(metrics)) {
    if (value instanceof Date) {
      formatted[key] = format(value, "yyyy-MM-dd");
    } else if (typeof value === "number") {
      // Format numbers with 2 decimal places
      formatted[key] = Math.round(value * 100) / 100;
    } else if (typeof value === "object" && value !== null) {
      // Skip nested objects for flat CSV export
      formatted[key] = JSON.stringify(value);
    } else {
      // Remaining types: string, boolean, null, undefined
      formatted[key] = value as ExportableValue;
    }
  }

  return formatted;
}
