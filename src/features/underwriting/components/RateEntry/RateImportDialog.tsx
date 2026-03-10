// src/features/underwriting/components/RateEntry/RateImportDialog.tsx
// Dialog for importing premium rates from CSV (Insurance Toolkits export)

import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCarriersWithProducts } from "../../hooks/coverage/useCarriersWithProducts";
// eslint-disable-next-line no-restricted-imports
import { bulkUpsertPremiumMatrix } from "@/services/underwriting/repositories/premiumMatrixService";
// eslint-disable-next-line no-restricted-imports
import type {
  GenderType,
  TobaccoClass,
  HealthClass,
  TermYears,
  BulkPremiumEntry,
} from "@/services/underwriting/repositories/premiumMatrixService";
// CarrierWithProducts type available via useCarriersWithProducts hook
// import type { CarrierWithProducts } from "../../types/underwriting.types";

interface RateImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ParsedRate {
  face_amount: number;
  company: string;
  plan_name: string;
  tier_name: string;
  monthly: number;
  yearly: number;
  state: string;
  gender: string;
  age: number;
  term_years: number;
  tobacco: string;
}

interface CarrierProductGroup {
  carrierName: string;
  productName: string;
  rates: ParsedRate[];
  // Unique plan names for display (helps identify different products)
  uniquePlanNames: string[];
  // Mapping
  mappedCarrierId?: string;
  mappedProductId?: string;
  createNewCarrier?: boolean;
  createNewProduct?: boolean;
  skipped?: boolean;
}

type Step = "paste" | "preview" | "mapping" | "importing" | "complete";

// Parse health class from plan name
function extractHealthClass(planName: string, tierName: string): HealthClass {
  const lowerPlan = planName.toLowerCase();

  if (lowerPlan.includes("preferred plus")) return "preferred_plus";
  if (lowerPlan.includes("preferred") && !lowerPlan.includes("plus"))
    return "preferred";
  if (lowerPlan.includes("standard plus")) return "standard_plus";
  if (
    lowerPlan.includes("standard") &&
    !lowerPlan.includes("plus") &&
    !lowerPlan.includes("preferred")
  )
    return "standard";

  // Simplified products with "Approved" tier
  if (tierName.toLowerCase() === "approved") return "standard";

  // Default
  return "standard";
}

// Parse carrier name from company string
function extractCarrierName(company: string): string {
  // "Transamerica (Trendsetter Super 2021)" → "Transamerica"
  // "Mutual of Omaha (Term Life Express)" → "Mutual of Omaha"
  const match = company.match(/^([^(]+)/);
  return match ? match[1].trim() : company;
}

// Extract product name for grouping, PRESERVING rating class but stripping term suffixes
// This is critical: products with different rating classes (Preferred vs Standard) are SEPARATE products
// Examples:
//   "Term Made Simple Preferred 10-Year" → "Term Made Simple Preferred"
//   "Term Made Simple Standard 10-Year" → "Term Made Simple Standard"
//   "Trendsetter Super 2021 10-Year Standard" → "Trendsetter Super 2021 Standard"
//   "Simple Term 20-Year" → "Simple Term"
//   "Simple Term Deluxe 20-Year" → "Simple Term Deluxe"
function extractProductName(company: string, planName: string): string {
  // First, try to extract from company parentheses
  // e.g., "Transamerica (Trendsetter Super 2021)" → "Trendsetter Super 2021"
  // BUT we still need to check the planName for rating class info
  const companyMatch = company.match(/\(([^)]+)\)/);
  const baseFromCompany = companyMatch ? companyMatch[1].trim() : null;

  // If no plan name, use company base
  if (!planName || !planName.trim()) {
    return baseFromCompany || company;
  }

  let baseName = planName.trim();

  // Strip term suffixes (10-Year, 15-Year, 20-Year, 25-Year, 30-Year)
  // Keep track of what we stripped and where
  baseName = baseName.replace(/\s*\d{1,2}-Year\s*/gi, " ").trim();

  // Strip "Non-Med" suffix (not a rating class, just a variant indicator)
  baseName = baseName.replace(/\s*Non-Med\s*/gi, " ").trim();

  // Clean up any double spaces
  baseName = baseName.replace(/\s+/g, " ").trim();

  // DO NOT strip rating classes (Preferred, Standard, etc.)
  // These differentiate products and should be preserved for proper mapping

  return baseName;
}

// Map gender
function mapGender(gender: string): GenderType {
  return gender.toLowerCase() === "female" ? "female" : "male";
}

// Map tobacco
function mapTobacco(tobacco: string): TobaccoClass {
  return tobacco.toLowerCase() === "tobacco" ? "tobacco" : "non_tobacco";
}

// Parse CSV content (supports both comma and tab-separated)
function parseCSV(csvContent: string): ParsedRate[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  // Detect delimiter: if first line has tabs, use tabs; otherwise use commas
  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  // Simple CSV parser that handles quoted fields
  const parseRow = (line: string): string[] => {
    if (delimiter === "\t") {
      return line.split("\t");
    }
    // For comma-delimited, handle quoted fields
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.trim().toLowerCase());

  // Find column indices
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    colMap[h] = i;
  });

  const rates: ParsedRate[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length < headers.length) continue;

    try {
      const monthly = parseFloat(
        values[colMap["monthly"]]?.replace(/,/g, "") || "0",
      );
      if (isNaN(monthly) || monthly <= 0) continue;

      rates.push({
        face_amount: parseFloat(
          values[colMap["face_amount"]]?.replace(/,/g, "") || "0",
        ),
        company: values[colMap["company"]]?.trim() || "",
        plan_name: values[colMap["plan_name"]]?.trim() || "",
        tier_name: values[colMap["tier_name"]]?.trim() || "",
        monthly,
        yearly: parseFloat(values[colMap["yearly"]]?.replace(/,/g, "") || "0"),
        state: values[colMap["state"]]?.trim() || "",
        gender: values[colMap["gender"]]?.trim() || "",
        age: parseInt(values[colMap["age"]] || "0", 10),
        term_years: parseInt(values[colMap["term_years"]] || "0", 10),
        tobacco: values[colMap["tobacco"]]?.trim() || "",
      });
    } catch {
      // Skip malformed rows
    }
  }

  return rates;
}

// Group rates by carrier/product
function groupByCarrierProduct(rates: ParsedRate[]): CarrierProductGroup[] {
  const groups = new Map<string, CarrierProductGroup>();

  for (const rate of rates) {
    const carrierName = extractCarrierName(rate.company);
    const productName = extractProductName(rate.company, rate.plan_name);
    const key = `${carrierName}|${productName}`;

    if (!groups.has(key)) {
      groups.set(key, {
        carrierName,
        productName,
        rates: [],
        uniquePlanNames: [],
      });
    }
    const group = groups.get(key)!;
    group.rates.push(rate);

    // Track unique plan names for display
    if (rate.plan_name && !group.uniquePlanNames.includes(rate.plan_name)) {
      group.uniquePlanNames.push(rate.plan_name);
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.carrierName.localeCompare(b.carrierName),
  );
}

export function RateImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: RateImportDialogProps) {
  const { user } = useAuth();
  const imoId = user?.imo_id;
  const { data: carriers } = useCarriersWithProducts();

  const [step, setStep] = useState<Step>("paste");
  const [csvContent, setCsvContent] = useState("");
  const [parsedRates, setParsedRates] = useState<ParsedRate[]>([]);
  const [groups, setGroups] = useState<CarrierProductGroup[]>([]);
  const [_importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    skipped: string[];
    errors: string[];
  }>({ success: 0, skipped: [], errors: [] });

  // Normalize product name for matching (lowercase, normalize spaces, handle common variations)
  const normalizeForMatching = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+plus\b/g, " plus") // normalize "plus" suffix
      .trim();
  };

  // Auto-map carriers and products
  const autoMapGroups = useCallback(
    (groupsToMap: CarrierProductGroup[]): CarrierProductGroup[] => {
      if (!carriers) return groupsToMap;

      return groupsToMap.map((group) => {
        // Try to find matching carrier (fuzzy match)
        const matchedCarrier = carriers.find(
          (c) =>
            c.name.toLowerCase().includes(group.carrierName.toLowerCase()) ||
            group.carrierName.toLowerCase().includes(c.name.toLowerCase()),
        );

        let mappedProductId: string | undefined;

        // If carrier found, try to find matching product
        // Priority: exact match > normalized match > starts with > contains
        if (matchedCarrier) {
          const productNameNorm = normalizeForMatching(group.productName);

          // 1. Try exact match first
          let matchedProduct = matchedCarrier.products.find(
            (p) => p.name.toLowerCase() === group.productName.toLowerCase(),
          );

          // 2. Try normalized match (handles "Preferred Plus" vs "Preferred-Plus" etc.)
          if (!matchedProduct) {
            matchedProduct = matchedCarrier.products.find(
              (p) => normalizeForMatching(p.name) === productNameNorm,
            );
          }

          // 3. Try normalized "starts with" match
          if (!matchedProduct) {
            matchedProduct = matchedCarrier.products.find((p) => {
              const pNorm = normalizeForMatching(p.name);
              return (
                pNorm.startsWith(productNameNorm) ||
                productNameNorm.startsWith(pNorm)
              );
            });
          }

          // 4. Try matching where one contains the other (but prefer longer matches)
          // Be more careful here to avoid false positives with rating classes
          if (!matchedProduct) {
            const candidates = matchedCarrier.products.filter((p) => {
              const pNorm = normalizeForMatching(p.name);
              // Both must share a significant base (at least first 2 words)
              const productWords = productNameNorm
                .split(" ")
                .slice(0, 2)
                .join(" ");
              const pWords = pNorm.split(" ").slice(0, 2).join(" ");
              return productWords === pWords;
            });

            // If we have candidates, pick the one with the best overlap
            if (candidates.length === 1) {
              matchedProduct = candidates[0];
            } else if (candidates.length > 1) {
              // Pick exact match if available, otherwise leave unmapped for manual selection
              matchedProduct = candidates.find(
                (p) => normalizeForMatching(p.name) === productNameNorm,
              );
            }
          }

          mappedProductId = matchedProduct?.id;
        }

        return {
          ...group,
          mappedCarrierId: matchedCarrier?.id,
          mappedProductId,
          createNewCarrier: !matchedCarrier,
          createNewProduct: matchedCarrier && !mappedProductId,
        };
      });
    },
    [carriers],
  );

  // Handle CSV paste
  const handleParse = () => {
    const rates = parseCSV(csvContent);
    if (rates.length === 0) {
      alert(
        "No valid rates found in CSV. Make sure you're pasting tab-separated data.",
      );
      return;
    }
    setParsedRates(rates);
    const grouped = groupByCarrierProduct(rates);
    setGroups(autoMapGroups(grouped));
    setStep("preview");
  };

  // Update mapping for a group
  const updateGroupMapping = (
    index: number,
    carrierId: string,
    productId: string,
  ) => {
    setGroups((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        mappedCarrierId: carrierId || undefined,
        mappedProductId: productId || undefined,
        createNewCarrier: !carrierId,
        createNewProduct: !!carrierId && !productId,
      };
      return updated;
    });
  };

  // Get products for a carrier
  const getProductsForCarrier = (carrierId: string) => {
    const carrier = carriers?.find((c) => c.id === carrierId);
    return carrier?.products || [];
  };

  // Toggle skip status for a group
  const toggleSkip = (index: number) => {
    setGroups((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        skipped: !updated[index].skipped,
      };
      return updated;
    });
  };

  // Count mapped vs unmapped vs skipped
  const mappingStats = useMemo(() => {
    const mapped = groups.filter((g) => g.mappedProductId && !g.skipped).length;
    const skipped = groups.filter((g) => g.skipped).length;
    const unmapped = groups.filter(
      (g) => !g.mappedProductId && !g.skipped,
    ).length;
    return { mapped, skipped, unmapped, total: groups.length };
  }, [groups]);

  // Handle import
  const handleImport = async () => {
    if (!imoId || !user?.id) return;

    setImporting(true);
    setStep("importing");
    const results = {
      success: 0,
      skipped: [] as string[],
      errors: [] as string[],
    };

    for (const group of groups) {
      // Skip explicitly skipped items
      if (group.skipped) {
        results.skipped.push(
          `${group.carrierName} - ${group.productName} (${group.rates.length} rates) [skipped by user]`,
        );
        continue;
      }

      // Skip unmapped items
      if (!group.mappedProductId) {
        results.skipped.push(
          `${group.carrierName} - ${group.productName} (${group.rates.length} rates) [no product mapped]`,
        );
        continue;
      }

      // Group rates by classification (gender, tobacco, health_class, term_years)
      const byClassification = new Map<string, ParsedRate[]>();

      for (const rate of group.rates) {
        const healthClass = extractHealthClass(rate.plan_name, rate.tier_name);
        const key = `${rate.gender}|${rate.tobacco}|${healthClass}|${rate.term_years}`;
        if (!byClassification.has(key)) {
          byClassification.set(key, []);
        }
        byClassification.get(key)!.push(rate);
      }

      // Insert each classification group
      for (const [key, rates] of byClassification) {
        const [gender, tobacco, healthClass, termYearsStr] = key.split("|");

        // Parse term years - use null for whole life (0 or empty)
        const parsedTermYears = parseInt(termYearsStr, 10);
        const validTermYears: TermYears | null = [10, 15, 20, 25, 30].includes(
          parsedTermYears,
        )
          ? (parsedTermYears as TermYears)
          : null;
        const termDisplay = validTermYears
          ? `${validTermYears}yr`
          : "whole life";

        try {
          const bulkEntry: BulkPremiumEntry = {
            productId: group.mappedProductId,
            gender: mapGender(gender),
            tobaccoClass: mapTobacco(tobacco),
            healthClass: healthClass as HealthClass,
            termYears: validTermYears,
            entries: rates.map((r) => ({
              age: r.age,
              faceAmount: r.face_amount,
              monthlyPremium: r.monthly,
            })),
          };

          const result = await bulkUpsertPremiumMatrix(
            bulkEntry,
            imoId,
            user.id,
          );
          results.success += result.saved;
        } catch (e) {
          results.errors.push(
            `Error importing ${group.productName} (${gender}/${tobacco}/${healthClass}/${termDisplay}): ${e instanceof Error ? e.message : "Unknown error"}`,
          );
        }
      }
    }

    setImportResults(results);
    setStep("complete");
    setImporting(false);
  };

  // Reset dialog
  const handleClose = () => {
    setCsvContent("");
    setParsedRates([]);
    setGroups([]);
    setStep("paste");
    setImportResults({ success: 0, skipped: [], errors: [] });
    onOpenChange(false);
    if (importResults.success > 0) {
      onImportComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4" />
            Import Premium Rates from CSV
          </DialogTitle>
          <DialogDescription className="text-xs">
            Paste CSV data from Insurance Toolkits rate export
          </DialogDescription>
        </DialogHeader>

        {/* Step: Paste */}
        {step === "paste" && (
          <div className="space-y-3 flex-1">
            <Textarea
              placeholder="Paste CSV data here (tab-separated from Excel/Sheets)..."
              className="h-64 text-xs font-mono"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
            />
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-zinc-500">
                Expected columns: face_amount, company, plan_name, tier_name,
                monthly, yearly, state, gender, age, term_years, tobacco
              </p>
              <Button
                size="sm"
                onClick={handleParse}
                disabled={!csvContent.trim()}
              >
                Parse CSV
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-xs">
                  {parsedRates.length} rates parsed
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {groups.length} carrier/products
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-green-600">
                  {mappingStats.mapped} mapped
                </span>
                {mappingStats.skipped > 0 && (
                  <span className="text-zinc-500">
                    {mappingStats.skipped} skipped
                  </span>
                )}
                {mappingStats.unmapped > 0 && (
                  <span className="text-amber-600">
                    {mappingStats.unmapped} unmapped
                  </span>
                )}
              </div>
            </div>

            <ScrollArea className="h-[350px] border rounded-md">
              <div className="p-2 space-y-2">
                {groups.map((group, idx) => (
                  <div
                    key={`${group.carrierName}-${group.productName}`}
                    className={`border rounded p-2 space-y-2 ${
                      group.skipped
                        ? "bg-zinc-100 dark:bg-zinc-800 opacity-60"
                        : "bg-zinc-50 dark:bg-zinc-900"
                    }`}
                  >
                    {/* Row 1: Carrier, Product, Badge, Skip button - always visible */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`text-[11px] font-medium shrink-0 ${group.skipped ? "line-through" : ""}`}
                        >
                          {group.carrierName}
                        </span>
                        <span
                          className={`text-[10px] text-zinc-500 truncate ${group.skipped ? "line-through" : ""}`}
                        >
                          {group.productName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={
                            group.skipped
                              ? "outline"
                              : group.mappedProductId
                                ? "default"
                                : "secondary"
                          }
                          className="text-[9px]"
                        >
                          {group.rates.length} rates
                        </Badge>
                        <Button
                          variant={group.skipped ? "default" : "ghost"}
                          size="sm"
                          className="h-5 px-1.5 text-[9px]"
                          onClick={() => toggleSkip(idx)}
                        >
                          {group.skipped ? (
                            <>Unskip</>
                          ) : (
                            <>
                              <SkipForward className="h-3 w-3 mr-0.5" />
                              Skip
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Row 2: Plans list - separate row, truncated */}
                    {group.uniquePlanNames.length > 0 && (
                      <div
                        className="text-[9px] text-blue-600 dark:text-blue-400 truncate max-w-full"
                        title={group.uniquePlanNames.join(", ")}
                      >
                        Plans: {group.uniquePlanNames.slice(0, 3).join(", ")}
                        {group.uniquePlanNames.length > 3 &&
                          ` +${group.uniquePlanNames.length - 3} more`}
                      </div>
                    )}

                    {!group.skipped && (
                      <div className="flex items-center gap-2">
                        {/* Carrier Select */}
                        <Select
                          value={group.mappedCarrierId || ""}
                          onValueChange={(v) => updateGroupMapping(idx, v, "")}
                        >
                          <SelectTrigger className="h-6 text-[10px] flex-1">
                            <SelectValue placeholder="Select carrier..." />
                          </SelectTrigger>
                          <SelectContent>
                            {carriers?.map((c) => (
                              <SelectItem
                                key={c.id}
                                value={c.id}
                                className="text-[10px]"
                              >
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Product Select */}
                        <Select
                          value={group.mappedProductId || ""}
                          onValueChange={(v) =>
                            updateGroupMapping(
                              idx,
                              group.mappedCarrierId || "",
                              v,
                            )
                          }
                          disabled={!group.mappedCarrierId}
                        >
                          <SelectTrigger className="h-6 text-[10px] flex-1">
                            <SelectValue placeholder="Select product..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getProductsForCarrier(
                              group.mappedCarrierId || "",
                            ).map((p) => (
                              <SelectItem
                                key={p.id}
                                value={p.id}
                                className="text-[10px]"
                              >
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Status Icon */}
                        {group.mappedProductId ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("paste")}
              >
                Back
              </Button>
              <div className="flex items-center gap-3">
                {(mappingStats.skipped > 0 || mappingStats.unmapped > 0) && (
                  <span className="text-[10px] text-zinc-500">
                    {mappingStats.skipped + mappingStats.unmapped} will be
                    skipped
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={mappingStats.mapped === 0}
                >
                  Import {mappingStats.mapped} of {mappingStats.total}
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
              <p className="text-sm mt-3">Importing rates...</p>
              <p className="text-xs text-zinc-500 mt-1">
                This may take a moment
              </p>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <div className="flex-1 space-y-4 py-4">
            <div className="text-center">
              {importResults.success > 0 ? (
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              ) : (
                <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
              )}
              <p className="text-lg font-medium mt-3">Import Complete</p>
              <p className="text-sm text-zinc-500">
                {importResults.success} rate entries imported
              </p>
            </div>

            {/* Skipped items (not errors, just unmapped) */}
            {importResults.skipped.length > 0 && (
              <div className="border rounded-md p-2 bg-zinc-50 dark:bg-zinc-900">
                <p className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Skipped ({importResults.skipped.length} unmapped):
                </p>
                <ScrollArea className="h-20">
                  <div className="space-y-0.5">
                    {importResults.skipped.map((item, i) => (
                      <p key={i} className="text-[10px] text-zinc-500">
                        {item}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Actual errors */}
            {importResults.errors.length > 0 && (
              <div className="border border-red-200 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-red-950">
                <p className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-1">
                  Errors ({importResults.errors.length}):
                </p>
                <ScrollArea className="h-24">
                  <div className="space-y-0.5">
                    {importResults.errors.map((err, i) => (
                      <p
                        key={i}
                        className="text-[10px] text-red-600 dark:text-red-400"
                      >
                        {err}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
