// src/features/settings/carriers/components/BuildTableEditor.tsx
// Manages multiple named build charts per carrier

import React, { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ruler,
  Save,
  Trash2,
  AlertCircle,
  Upload,
  Download,
  FileSpreadsheet,
  Plus,
  Star,
  Scale,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCarrierBuildCharts } from "../hooks/useCarrierBuildCharts";
import { useCreateBuildChart } from "../hooks/useCreateBuildChart";
import { useUpdateBuildChart } from "../hooks/useUpdateBuildChart";
import { useDeleteBuildChart } from "../hooks/useDeleteBuildChart";
import { useSetDefaultBuildChart } from "../hooks/useSetDefaultBuildChart";
import {
  type BuildTableData,
  type BuildTableRow,
  type BuildTableWeightRanges,
  type BmiTableData,
  type BmiRange,
  type WeightRange,
  type BuildTableType,
  type BuildChartDisplay,
  type RatingClassKey,
  generateHeightOptions,
  createEmptyBuildTable,
  createEmptyBmiTable,
  BUILD_TABLE_TYPE_LABELS,
  ALL_RATING_CLASSES,
  getActiveRatingClasses,
  getActiveBmiClasses,
  parseBuildTableCsv,
  exportBuildTableToCsv,
  generateCsvTemplate,
  downloadCsv,
} from "@/features/underwriting";
import type { Carrier } from "../hooks/useCarriers";

interface BuildChartsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrier: Carrier | null;
}

const HEIGHT_OPTIONS = generateHeightOptions();

export function BuildChartsManager({
  open,
  onOpenChange,
  carrier,
}: BuildChartsManagerProps) {
  // Fetch all build charts for this carrier
  const { data: charts = [], isLoading } = useCarrierBuildCharts(carrier?.id);

  // State for editing
  const [editingChart, setEditingChart] = useState<BuildChartDisplay | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chartToDelete, setChartToDelete] = useState<BuildChartDisplay | null>(
    null,
  );

  // Editor state
  const [chartName, setChartName] = useState("");
  const [tableType, setTableType] = useState<BuildTableType>("height_weight");
  const [buildData, setBuildData] = useState<BuildTableData>(() =>
    createEmptyBuildTable(),
  );
  const [bmiData, setBmiData] = useState<BmiTableData>(() =>
    createEmptyBmiTable(),
  );
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [_hasChanges, setHasChanges] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<Set<RatingClassKey>>(
    new Set(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const createMutation = useCreateBuildChart();
  const updateMutation = useUpdateBuildChart();
  const deleteMutation = useDeleteBuildChart();
  const setDefaultMutation = useSetDefaultBuildChart();

  // Reset editor state
  const resetEditor = () => {
    setChartName("");
    setTableType("height_weight");
    setBuildData(createEmptyBuildTable());
    setBmiData(createEmptyBmiTable());
    setNotes("");
    setIsDefault(false);
    setHasChanges(false);
    setCsvErrors([]);
    setSelectedClasses(new Set());
    setEditingChart(null);
    setIsCreating(false);
  };

  // Reset editor when carrier changes or sheet closes
  useEffect(() => {
    if (!open) {
      resetEditor();
    }
  }, [open, carrier?.id]);

  // Load chart data when editing
  useEffect(() => {
    if (editingChart) {
      setChartName(editingChart.name);
      setTableType(editingChart.tableType);
      setBuildData(
        editingChart.buildData.length > 0
          ? editingChart.buildData
          : createEmptyBuildTable(),
      );
      setBmiData(editingChart.bmiData || createEmptyBmiTable());
      setNotes(editingChart.notes || "");
      setIsDefault(editingChart.isDefault);
      setHasChanges(false);

      // Derive selected classes from existing data
      const activeClasses =
        editingChart.tableType === "bmi"
          ? getActiveBmiClasses(editingChart.bmiData)
          : getActiveRatingClasses(editingChart.buildData);
      setSelectedClasses(new Set(activeClasses));
    }
  }, [editingChart]);

  // Height/Weight handlers
  const handleWeightChange = (
    heightInches: number,
    ratingClass: RatingClassKey,
    field: "min" | "max",
    value: string,
  ) => {
    const numValue = value === "" ? undefined : parseFloat(value);

    setBuildData((prev) =>
      prev.map((row) => {
        if (row.heightInches === heightInches) {
          const currentRange = row.weightRanges[ratingClass] || {};
          const newRange: WeightRange = {
            ...currentRange,
            [field]: numValue,
          };
          const isEmptyRange =
            newRange.min === undefined && newRange.max === undefined;

          return {
            ...row,
            weightRanges: {
              ...row.weightRanges,
              [ratingClass]: isEmptyRange ? undefined : newRange,
            },
          };
        }
        return row;
      }),
    );
    setHasChanges(true);
  };

  // BMI handlers
  const handleBmiChange = (
    ratingClass: RatingClassKey,
    field: "min" | "max",
    value: string,
  ) => {
    const numValue = value === "" ? undefined : parseFloat(value);

    setBmiData((prev) => {
      const currentRange = prev[ratingClass] || {};
      const newRange: BmiRange = {
        ...currentRange,
        [field]: numValue,
      };
      const isEmptyRange =
        newRange.min === undefined && newRange.max === undefined;

      return {
        ...prev,
        [ratingClass]: isEmptyRange ? undefined : newRange,
      };
    });
    setHasChanges(true);
  };

  const getWeightValue = (
    row: BuildTableRow,
    ratingClass: RatingClassKey,
    field: "min" | "max",
  ): string => {
    const range = row.weightRanges[ratingClass];
    const value = range?.[field];
    return value !== undefined ? String(value) : "";
  };

  const getBmiValue = (
    ratingClass: RatingClassKey,
    field: "min" | "max",
  ): string => {
    const range = bmiData[ratingClass];
    const value = range?.[field];
    return value !== undefined ? String(value) : "";
  };

  // Clear data for a rating class when unchecked
  const clearRatingClassData = (classKey: RatingClassKey) => {
    if (tableType === "height_weight") {
      setBuildData((prev) =>
        prev.map((row) => ({
          ...row,
          weightRanges: {
            ...row.weightRanges,
            [classKey]: undefined,
          },
        })),
      );
    } else {
      setBmiData((prev) => ({
        ...prev,
        [classKey]: undefined,
      }));
    }
  };

  // Toggle rating class selection
  const handleClassToggle = (classKey: RatingClassKey, checked: boolean) => {
    const newSet = new Set(selectedClasses);
    if (checked) {
      newSet.add(classKey);
    } else {
      newSet.delete(classKey);
      clearRatingClassData(classKey);
    }
    setSelectedClasses(newSet);
    setHasChanges(true);
  };

  // Get selected classes in standard order for rendering
  const orderedSelectedClasses = ALL_RATING_CLASSES.filter((rc) =>
    selectedClasses.has(rc.key),
  );

  // CSV handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = parseBuildTableCsv(content);

      if (result.success && result.data) {
        setBuildData(result.data);
        setHasChanges(true);
        setCsvErrors([]);
        if (result.warnings) {
          setCsvErrors(result.warnings);
        }
      } else {
        setCsvErrors(result.errors || ["Failed to parse CSV"]);
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExportCsv = () => {
    const activeClasses = Array.from(selectedClasses);
    const csv = exportBuildTableToCsv(buildData, activeClasses);
    const filename = `${carrier?.name || "carrier"}_${chartName || "build_chart"}.csv`;
    downloadCsv(csv, filename);
  };

  const handleDownloadTemplate = () => {
    const activeClasses = Array.from(selectedClasses);
    const csv = generateCsvTemplate(activeClasses);
    downloadCsv(csv, "build_chart_template.csv");
  };

  // Save handler
  const handleSave = async () => {
    if (!carrier?.id || !chartName.trim()) return;

    // Validate at least one rating class is selected
    if (selectedClasses.size === 0) {
      setCsvErrors(["Please select at least one rating class"]);
      return;
    }

    // Filter build data to only include selected classes and non-empty rows
    const filteredBuildData = buildData
      .map((row) => {
        const filteredRanges: BuildTableWeightRanges = {};
        for (const classKey of selectedClasses) {
          const range = row.weightRanges[classKey];
          if (range !== undefined) {
            filteredRanges[classKey] = range;
          }
        }
        return { ...row, weightRanges: filteredRanges };
      })
      .filter((row) => Object.keys(row.weightRanges).length > 0);

    // Filter BMI data to only include selected classes
    const filteredBmiData: BmiTableData = {};
    if (tableType === "bmi" && bmiData) {
      for (const classKey of selectedClasses) {
        const range = bmiData[classKey];
        if (range !== undefined) {
          filteredBmiData[classKey] = range;
        }
      }
    }

    if (editingChart) {
      await updateMutation.mutateAsync({
        id: editingChart.id,
        carrierId: carrier.id,
        name: chartName.trim(),
        tableType,
        buildData: filteredBuildData,
        bmiData: tableType === "bmi" ? filteredBmiData : null,
        notes: notes || null,
        isDefault,
      });
    } else {
      await createMutation.mutateAsync({
        carrierId: carrier.id,
        name: chartName.trim(),
        tableType,
        buildData: filteredBuildData,
        bmiData: tableType === "bmi" ? filteredBmiData : null,
        notes: notes || null,
        isDefault,
      });
    }

    resetEditor();
  };

  // Delete handler
  const handleDelete = async () => {
    if (!chartToDelete || !carrier?.id) return;

    await deleteMutation.mutateAsync({
      chartId: chartToDelete.id,
      carrierId: carrier.id,
    });

    setShowDeleteConfirm(false);
    setChartToDelete(null);
    resetEditor();
  };

  // Set default handler
  const handleSetDefault = async (chart: BuildChartDisplay) => {
    if (!carrier?.id) return;
    await setDefaultMutation.mutateAsync({
      chartId: chart.id,
      carrierId: carrier.id,
    });
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    setDefaultMutation.isPending;

  // Render chart list view
  if (!editingChart && !isCreating) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg p-0 bg-v2-card border-v2-ring flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-v2-ring/60">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-v2-ink-subtle" />
              <div>
                <SheetTitle className="text-sm font-semibold text-v2-ink">
                  Build Charts: {carrier?.name}
                </SheetTitle>
                <SheetDescription className="text-[10px] text-v2-ink-muted">
                  Manage height/weight and BMI charts for this carrier
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-auto px-4 py-3">
            {isLoading ? (
              <div className="text-center py-8 text-[11px] text-v2-ink-muted">
                Loading charts...
              </div>
            ) : charts.length === 0 ? (
              <div className="text-center py-8">
                <Ruler className="h-8 w-8 mx-auto mb-2 text-v2-ink-subtle" />
                <p className="text-[11px] text-v2-ink-muted mb-3">
                  No build charts configured for this carrier.
                </p>
                <Button
                  size="sm"
                  onClick={() => setIsCreating(true)}
                  className="h-7 text-[10px]"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Build Chart
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {charts.map((chart) => (
                  <div
                    key={chart.id}
                    className="border border-v2-ring rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-v2-ink truncate">
                            {chart.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="h-4 px-1 text-[9px]"
                          >
                            {BUILD_TABLE_TYPE_LABELS[chart.tableType]}
                          </Badge>
                          {chart.isDefault && (
                            <Badge
                              variant="default"
                              className="h-4 px-1 text-[9px]"
                            >
                              <Star className="h-2.5 w-2.5 mr-0.5" />
                              Default
                            </Badge>
                          )}
                        </div>
                        {chart.notes && (
                          <p className="text-[10px] text-v2-ink-muted mt-1 truncate">
                            {chart.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!chart.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(chart)}
                            disabled={isPending}
                            className="h-6 px-2 text-[10px]"
                            title="Set as default"
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingChart(chart)}
                          disabled={isPending}
                          className="h-6 px-2 text-[10px]"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setChartToDelete(chart);
                            setShowDeleteConfirm(true);
                          }}
                          disabled={isPending}
                          className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <SheetFooter className="px-4 py-3 border-t border-v2-ring/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7 text-[10px]"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              disabled={isPending}
              className="h-7 text-[10px]"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Chart
            </Button>
          </SheetFooter>
        </SheetContent>

        {/* Delete confirmation */}
        <AlertDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm">
                Delete Build Chart
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[11px]">
                Are you sure you want to delete "{chartToDelete?.name}"? This
                action cannot be undone. Products using this chart will need to
                select a different one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-7 text-[10px]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="h-7 text-[10px] bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Sheet>
    );
  }

  // Render editor view
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl p-0 bg-v2-card border-v2-ring flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-v2-ring/60">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-v2-ink-subtle" />
            <div>
              <SheetTitle className="text-sm font-semibold text-v2-ink">
                {editingChart ? "Edit Build Chart" : "New Build Chart"}
              </SheetTitle>
              <SheetDescription className="text-[10px] text-v2-ink-muted">
                {carrier?.name}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
          {/* Chart Name */}
          <div className="space-y-1">
            <Label className="text-[10px] font-medium text-v2-ink-muted uppercase">
              Chart Name *
            </Label>
            <Input
              value={chartName}
              onChange={(e) => {
                setChartName(e.target.value);
                setHasChanges(true);
              }}
              placeholder="e.g., Term Life Build Chart"
              className="h-7 text-[11px]"
            />
          </div>

          {/* Table Type */}
          <div className="space-y-1">
            <Label className="text-[10px] font-medium text-v2-ink-muted uppercase">
              Chart Type
            </Label>
            <Select
              value={tableType}
              onValueChange={(v) => {
                setTableType(v as BuildTableType);
                setHasChanges(true);
              }}
            >
              <SelectTrigger className="h-7 text-[11px] w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="height_weight" className="text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Ruler className="h-3 w-3" />
                    Height/Weight Chart
                  </span>
                </SelectItem>
                <SelectItem value="bmi" className="text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Scale className="h-3 w-3" />
                    BMI Chart
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rating Class Selection */}
          <div className="space-y-1">
            <Label className="text-[10px] font-medium text-v2-ink-muted uppercase">
              Rating Classes
            </Label>
            <div className="flex flex-wrap gap-4">
              {ALL_RATING_CLASSES.slice(0, 4).map((rc) => (
                <label
                  key={rc.key}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedClasses.has(rc.key)}
                    onChange={(e) =>
                      handleClassToggle(rc.key, e.target.checked)
                    }
                    className="h-3.5 w-3.5 rounded border-v2-ring text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-v2-ink-muted">
                    {rc.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-1 border-t border-v2-ring/60 mt-1">
              <span className="text-[10px] text-v2-ink-subtle self-center">
                Substandard:
              </span>
              {ALL_RATING_CLASSES.slice(4).map((rc) => (
                <label
                  key={rc.key}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedClasses.has(rc.key)}
                    onChange={(e) =>
                      handleClassToggle(rc.key, e.target.checked)
                    }
                    className="h-3 w-3 rounded border-v2-ring text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    {rc.shortLabel}
                  </span>
                </label>
              ))}
            </div>
            {selectedClasses.size === 0 && (
              <p className="text-[10px] text-amber-600 mt-1">
                Select at least one rating class to configure weight ranges.
              </p>
            )}
          </div>

          {/* CSV Import/Export for Height/Weight */}
          {tableType === "height_weight" && selectedClasses.size > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-6 px-2 text-[10px]"
              >
                <Upload className="h-3 w-3 mr-1" />
                Import CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-6 px-2 text-[10px]"
              >
                <Download className="h-3 w-3 mr-1" />
                Export CSV
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDownloadTemplate}
                className="h-6 px-2 text-[10px]"
              >
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                Template
              </Button>
            </div>
          )}

          {/* CSV Errors */}
          {csvErrors.length > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5" />
                <div className="text-[10px] text-amber-800 dark:text-amber-200">
                  {csvErrors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BMI Editor */}
          {tableType === "bmi" && selectedClasses.size > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-v2-ink-muted">
                Enter min/max BMI values for each rating class.
              </p>
              <div className="border border-v2-ring rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-v2-canvas border-b border-v2-ring">
                      <th className="text-[10px] font-semibold text-v2-ink-muted text-left px-2 py-1.5 w-24">
                        Rating Class
                      </th>
                      <th className="text-[10px] font-semibold text-v2-ink-muted text-center px-1 py-1.5">
                        Min BMI
                      </th>
                      <th className="text-[10px] font-semibold text-v2-ink-muted text-center px-1 py-1.5">
                        Max BMI
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedSelectedClasses.map((rc, idx) => (
                      <tr
                        key={rc.key}
                        className={`border-b border-v2-ring/60 ${
                          idx % 2 === 0 ? "bg-v2-card" : "bg-v2-canvas"
                        }`}
                      >
                        <td className="text-[11px] font-medium text-v2-ink-muted px-2 py-1.5">
                          {rc.shortLabel}
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={getBmiValue(rc.key, "min")}
                            onChange={(e) =>
                              handleBmiChange(rc.key, "min", e.target.value)
                            }
                            placeholder="—"
                            className="h-6 text-[11px] text-center px-1 w-20 mx-auto"
                            min={0}
                            max={100}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={getBmiValue(rc.key, "max")}
                            onChange={(e) =>
                              handleBmiChange(rc.key, "max", e.target.value)
                            }
                            placeholder="—"
                            className="h-6 text-[11px] text-center px-1 w-20 mx-auto"
                            min={0}
                            max={100}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Height/Weight Editor */}
          {tableType === "height_weight" && selectedClasses.size > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-v2-ink-muted">
                Enter min/max weight (lbs) for each height and rating class.
              </p>
              <div className="border border-v2-ring rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-v2-canvas border-b border-v2-ring">
                        <th
                          rowSpan={2}
                          className="text-[10px] font-semibold text-v2-ink-muted text-left px-2 py-1.5 w-14 sticky left-0 bg-v2-canvas border-r border-v2-ring"
                        >
                          Height
                        </th>
                        {orderedSelectedClasses.map((rc) => (
                          <th
                            key={rc.key}
                            colSpan={2}
                            className="text-[10px] font-semibold text-v2-ink-muted text-center px-1 py-1 border-l border-v2-ring"
                          >
                            {rc.shortLabel}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-v2-canvas border-b border-v2-ring">
                        {orderedSelectedClasses.map((rc) => (
                          <React.Fragment key={rc.key}>
                            <th className="text-[9px] font-medium text-v2-ink-muted text-center px-0.5 py-0.5 border-l border-v2-ring">
                              Min
                            </th>
                            <th className="text-[9px] font-medium text-v2-ink-muted text-center px-0.5 py-0.5">
                              Max
                            </th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HEIGHT_OPTIONS.map((height, idx) => {
                        const row = buildData.find(
                          (r) => r.heightInches === height.inches,
                        ) || { heightInches: height.inches, weightRanges: {} };

                        return (
                          <tr
                            key={height.inches}
                            className={`border-b border-v2-ring/60 ${
                              idx % 2 === 0 ? "bg-v2-card" : "bg-v2-canvas"
                            }`}
                          >
                            <td className="text-[11px] font-medium text-v2-ink-muted px-2 py-0.5 w-14 sticky left-0 bg-inherit border-r border-v2-ring">
                              {height.formatted}
                            </td>
                            {orderedSelectedClasses.map((rc) => (
                              <React.Fragment key={rc.key}>
                                <td className="px-1 py-0.5 border-l border-v2-ring">
                                  <Input
                                    type="number"
                                    step="any"
                                    value={getWeightValue(row, rc.key, "min")}
                                    onChange={(e) =>
                                      handleWeightChange(
                                        height.inches,
                                        rc.key,
                                        "min",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="—"
                                    className="h-5 text-[10px] text-center px-1 w-14"
                                    min={0}
                                    max={500}
                                  />
                                </td>
                                <td className="px-1 py-0.5">
                                  <Input
                                    type="number"
                                    step="any"
                                    value={getWeightValue(row, rc.key, "max")}
                                    onChange={(e) =>
                                      handleWeightChange(
                                        height.inches,
                                        rc.key,
                                        "max",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="—"
                                    className="h-5 text-[10px] text-center px-1 w-14"
                                    min={0}
                                    max={500}
                                  />
                                </td>
                              </React.Fragment>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-[10px] font-medium text-v2-ink-muted uppercase">
              Notes (optional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Source, version, or other notes..."
              className="h-16 text-[11px] resize-none"
            />
          </div>
        </div>

        <SheetFooter className="px-4 py-3 border-t border-v2-ring/60 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetEditor}
            disabled={isPending}
            className="h-7 px-2 text-[10px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!chartName.trim() || isPending}
            className="h-7 px-3 text-[10px]"
          >
            <Save className="h-3 w-3 mr-1" />
            {isPending
              ? "Saving..."
              : editingChart
                ? "Update Chart"
                : "Create Chart"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Re-export with old name for backward compatibility
export const BuildTableEditor = BuildChartsManager;
