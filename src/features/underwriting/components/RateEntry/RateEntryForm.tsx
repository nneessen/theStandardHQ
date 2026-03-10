// src/features/underwriting/components/RateEntry/RateEntryForm.tsx
// Form for entering premium rates for a product

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Upload } from "lucide-react";
import {
  useProductRates,
  useUpsertRate,
  useBulkUpsertRates,
} from "../../hooks/rates/useRates";
// eslint-disable-next-line no-restricted-imports
import {
  AGE_BANDS,
  GENDER_OPTIONS,
  TOBACCO_OPTIONS,
  HEALTH_CLASS_OPTIONS,
  type GenderType,
  type TobaccoClass,
  type HealthClass,
  parseRateCSV,
} from "@/services/underwriting/repositories/rateService";
import { toast } from "sonner";

interface RateEntryFormProps {
  productId: string;
  productName: string;
  carrierName: string;
  onClose?: () => void;
}

type RateMatrix = Record<string, number | undefined>; // key: `${ageBand}-${gender}-${tobacco}-${health}`

export function RateEntryForm({
  productId,
  productName,
  carrierName,
}: RateEntryFormProps) {
  const [selectedGender, setSelectedGender] = useState<GenderType>("male");
  const [selectedTobacco, setSelectedTobacco] =
    useState<TobaccoClass>("non_tobacco");
  const [selectedHealth, setSelectedHealth] = useState<HealthClass>("standard");
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { data: existingRates, isLoading } = useProductRates(productId);

  const _upsertRate = useUpsertRate(); // Available for individual rate edits
  const bulkUpsert = useBulkUpsertRates();

  // Build a lookup map from existing rates
  const rateMap = useMemo(() => {
    const map: RateMatrix = {};
    if (existingRates) {
      for (const rate of existingRates) {
        const key = `${rate.age_band_start}-${rate.age_band_end}-${rate.gender}-${rate.tobacco_class}-${rate.health_class}`;
        map[key] = Number(rate.rate_per_thousand);
      }
    }
    return map;
  }, [existingRates]);

  // Get the current rate for a specific age band
  const getRate = (
    ageBandStart: number,
    ageBandEnd: number,
  ): number | undefined => {
    const key = `${ageBandStart}-${ageBandEnd}-${selectedGender}-${selectedTobacco}-${selectedHealth}`;
    // Check user input first, then existing data
    if (rateInputs[key] !== undefined) {
      const val = parseFloat(rateInputs[key]);
      return isNaN(val) ? undefined : val;
    }
    return rateMap[key];
  };

  // Handle rate input change
  const handleRateChange = (
    ageBandStart: number,
    ageBandEnd: number,
    value: string,
  ) => {
    const key = `${ageBandStart}-${ageBandEnd}-${selectedGender}-${selectedTobacco}-${selectedHealth}`;
    setRateInputs((prev) => ({ ...prev, [key]: value }));
  };

  // Save all entered rates
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const ratesToSave = Object.entries(rateInputs)
        .filter(([_, value]) => value !== "" && !isNaN(parseFloat(value)))
        .map(([key, value]) => {
          const [ageStart, ageEnd, gender, tobacco, health] = key.split("-");
          return {
            ageBandStart: parseInt(ageStart, 10),
            ageBandEnd: parseInt(ageEnd, 10),
            gender: gender as GenderType,
            tobaccoClass: tobacco as TobaccoClass,
            healthClass: health as HealthClass,
            ratePerThousand: parseFloat(value),
          };
        });

      if (ratesToSave.length === 0) {
        toast.info("No rates to save");
        return;
      }

      await bulkUpsert.mutateAsync({
        productId,
        rates: ratesToSave,
      });

      toast.success(`Saved ${ratesToSave.length} rates`);
      setRateInputs({});
    } catch (error) {
      console.error("Error saving rates:", error);
      toast.error("Failed to save rates");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle CSV import
  const handleCSVImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = parseRateCSV(content, productId);

      if (parsed.rates.length === 0) {
        toast.error("No valid rates found in CSV");
        return;
      }

      await bulkUpsert.mutateAsync(parsed);
      toast.success(`Imported ${parsed.rates.length} rates from CSV`);
    } catch (error) {
      console.error("Error importing CSV:", error);
      toast.error("Failed to import CSV");
    }

    // Reset input
    event.target.value = "";
  };

  // Count rates entered for current filter
  const ratesEnteredCount = useMemo(() => {
    let count = 0;
    for (const band of AGE_BANDS) {
      const key = `${band.start}-${band.end}-${selectedGender}-${selectedTobacco}-${selectedHealth}`;
      if (
        rateMap[key] !== undefined ||
        (rateInputs[key] && !isNaN(parseFloat(rateInputs[key])))
      ) {
        count++;
      }
    }
    return count;
  }, [rateMap, rateInputs, selectedGender, selectedTobacco, selectedHealth]);

  // Count total rates for this product
  const totalRatesCount = existingRates?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{productName}</CardTitle>
            <p className="text-sm text-muted-foreground">{carrierName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{totalRatesCount} rates saved</Badge>
            <label htmlFor="csv-import">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Import CSV
                </span>
              </Button>
            </label>
            <input
              id="csv-import"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVImport}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Controls */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Gender</Label>
            <Select
              value={selectedGender}
              onValueChange={(v) => setSelectedGender(v as GenderType)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tobacco Class</Label>
            <Select
              value={selectedTobacco}
              onValueChange={(v) => setSelectedTobacco(v as TobaccoClass)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOBACCO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Health Class</Label>
            <Select
              value={selectedHealth}
              onValueChange={(v) => setSelectedHealth(v as HealthClass)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEALTH_CLASS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Rate Table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Age Band</TableHead>
                <TableHead className="w-32">Rate per $1,000</TableHead>
                <TableHead className="text-right text-xs text-muted-foreground">
                  Example: $100K = Rate × 100
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {AGE_BANDS.map((band) => {
                const currentRate = getRate(band.start, band.end);
                const key = `${band.start}-${band.end}-${selectedGender}-${selectedTobacco}-${selectedHealth}`;
                const inputValue =
                  rateInputs[key] ?? (currentRate?.toString() || "");
                const hasExisting = rateMap[key] !== undefined;

                return (
                  <TableRow key={band.label}>
                    <TableCell className="font-medium">{band.label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={inputValue}
                          onChange={(e) =>
                            handleRateChange(
                              band.start,
                              band.end,
                              e.target.value,
                            )
                          }
                          className="h-7 w-24"
                        />
                        {hasExisting && !rateInputs[key] && (
                          <Badge variant="secondary" className="text-xs">
                            saved
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {currentRate
                        ? `$${(currentRate * 100).toFixed(2)}/mo`
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {ratesEnteredCount} of {AGE_BANDS.length} age bands have rates for
            this filter
          </p>
          <Button
            onClick={handleSaveAll}
            disabled={isSaving || Object.keys(rateInputs).length === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Rates
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
