// src/features/underwriting/components/CriteriaReview/CriteriaReviewDashboard.tsx

import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Percent,
  Building,
  FileText,
  Trash2,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useCriteriaList } from "../../hooks/criteria/useCriteria";
import {
  useDeleteCriteria,
  useUpdateCriteriaContent,
} from "../../hooks/criteria/useExtractCriteria";
import { useCanManageUnderwriting } from "../../hooks/wizard/useUnderwritingFeatureFlag";
import { CriteriaEditor } from "./CriteriaEditor";
import { CreateCriteriaDialog } from "./CreateCriteriaDialog";
import type {
  CriteriaWithRelations,
  ExtractedCriteria,
  ExtractionStatus,
  ReviewStatus,
} from "../../types/underwriting.types";
import type { Json } from "@/types/database.types";
import { formatSessionDate } from "../../utils/shared/formatters";

type SortField = "created_at" | "confidence" | "carrier" | "review_status";
type SortDirection = "asc" | "desc";

export function CriteriaReviewDashboard() {
  const { data: criteriaList, isLoading, error, refetch } = useCriteriaList();
  const deleteMutation = useDeleteCriteria();
  const updateContentMutation = useUpdateCriteriaContent();
  const { canManage } = useCanManageUnderwriting();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [extractionStatusFilter, setExtractionStatusFilter] =
    useState<string>("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Selected criteria for editor view
  const [selectedCriteria, setSelectedCriteria] =
    useState<CriteriaWithRelations | null>(null);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [criteriaToDelete, setCriteriaToDelete] =
    useState<CriteriaWithRelations | null>(null);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Get unique carriers for filter dropdown
  const uniqueCarriers = useMemo(() => {
    if (!criteriaList) return [];
    const carriers = new Map<string, string>();
    criteriaList.forEach((c) => {
      if (c.carrier?.id && c.carrier?.name) {
        carriers.set(c.carrier.id, c.carrier.name);
      }
    });
    return Array.from(carriers.entries()).map(([id, name]) => ({ id, name }));
  }, [criteriaList]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!criteriaList) return [];

    const filtered = criteriaList.filter((criteria) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          criteria.carrier?.name?.toLowerCase().includes(query) ||
          criteria.guide?.name?.toLowerCase().includes(query) ||
          criteria.product?.name?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Carrier filter
      if (carrierFilter !== "all" && criteria.carrier?.id !== carrierFilter) {
        return false;
      }

      // Extraction status filter
      if (
        extractionStatusFilter !== "all" &&
        criteria.extraction_status !== extractionStatusFilter
      ) {
        return false;
      }

      // Review status filter
      if (
        reviewStatusFilter !== "all" &&
        (criteria.review_status || "pending") !== reviewStatusFilter
      ) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "created_at":
          comparison =
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime();
          break;
        case "confidence":
          comparison =
            (a.extraction_confidence || 0) - (b.extraction_confidence || 0);
          break;
        case "carrier":
          comparison = (a.carrier?.name || "").localeCompare(
            b.carrier?.name || "",
          );
          break;
        case "review_status":
          comparison = (a.review_status || "pending").localeCompare(
            b.review_status || "pending",
          );
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [
    criteriaList,
    searchQuery,
    carrierFilter,
    extractionStatusFilter,
    reviewStatusFilter,
    sortField,
    sortDirection,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleDeleteClick = (criteria: CriteriaWithRelations) => {
    setCriteriaToDelete(criteria);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!criteriaToDelete) return;
    try {
      await deleteMutation.mutateAsync(criteriaToDelete.id);
      setDeleteConfirmOpen(false);
      setCriteriaToDelete(null);
    } catch {
      // Error handled by mutation
    }
  };

  // Handle save from editor
  const handleSaveCriteria = async (criteriaContent: ExtractedCriteria) => {
    if (!selectedCriteria) return;
    await updateContentMutation.mutateAsync({
      criteriaId: selectedCriteria.id,
      criteria: criteriaContent as unknown as Record<string, unknown>,
    });
    // Update the selected criteria in state to reflect the change
    setSelectedCriteria((prev) =>
      prev ? { ...prev, criteria: criteriaContent as unknown as Json } : null,
    );
  };

  // Show editor if a criteria is selected
  if (selectedCriteria) {
    return (
      <CriteriaEditor
        criteria={selectedCriteria}
        onBack={() => {
          setSelectedCriteria(null);
          refetch();
        }}
        onSave={handleSaveCriteria}
        canEdit={canManage}
      />
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500 dark:text-red-400 text-[11px]">
        Failed to load criteria: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
            Extracted Criteria Review
          </h3>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Review and approve AI-extracted underwriting criteria
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Criteria
            </Button>
          )}
          {criteriaList && (
            <Badge variant="secondary" className="text-[10px]">
              {filteredAndSortedData.length} of {criteriaList.length} records
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
          <Input
            placeholder="Search carrier, guide, product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-[11px]"
          />
        </div>

        <Select value={carrierFilter} onValueChange={setCarrierFilter}>
          <SelectTrigger className="h-7 w-[140px] text-[10px]">
            <Building className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Carrier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All Carriers
            </SelectItem>
            {uniqueCarriers.map((carrier) => (
              <SelectItem
                key={carrier.id}
                value={carrier.id}
                className="text-[11px]"
              >
                {carrier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={extractionStatusFilter}
          onValueChange={setExtractionStatusFilter}
        >
          <SelectTrigger className="h-7 w-[130px] text-[10px]">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Extraction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All Statuses
            </SelectItem>
            <SelectItem value="completed" className="text-[11px]">
              Completed
            </SelectItem>
            <SelectItem value="processing" className="text-[11px]">
              Processing
            </SelectItem>
            <SelectItem value="failed" className="text-[11px]">
              Failed
            </SelectItem>
            <SelectItem value="pending" className="text-[11px]">
              Pending
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={reviewStatusFilter}
          onValueChange={setReviewStatusFilter}
        >
          <SelectTrigger className="h-7 w-[130px] text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Review" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All Reviews
            </SelectItem>
            <SelectItem value="pending" className="text-[11px]">
              Pending
            </SelectItem>
            <SelectItem value="approved" className="text-[11px]">
              Approved
            </SelectItem>
            <SelectItem value="rejected" className="text-[11px]">
              Rejected
            </SelectItem>
            <SelectItem value="needs_revision" className="text-[11px]">
              Needs Revision
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 dark:bg-zinc-800/50">
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("carrier")}
                  className="h-auto p-0 text-[10px] font-semibold hover:bg-transparent"
                >
                  Carrier
                  <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                Guide / Product
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("confidence")}
                  className="h-auto p-0 text-[10px] font-semibold hover:bg-transparent"
                >
                  Confidence
                  <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 text-center">
                Extraction
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("review_status")}
                  className="h-auto p-0 text-[10px] font-semibold hover:bg-transparent"
                >
                  Review
                  <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("created_at")}
                  className="h-auto p-0 text-[10px] font-semibold hover:bg-transparent"
                >
                  Extracted
                  <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 w-[60px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <Skeleton className="h-4 w-12 mx-auto" />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <Skeleton className="h-5 w-16 mx-auto" />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <Skeleton className="h-5 w-16 mx-auto" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-6 w-6" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredAndSortedData.length > 0 ? (
              filteredAndSortedData.map((criteria) => (
                <TableRow
                  key={criteria.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer"
                  onClick={() => setSelectedCriteria(criteria)}
                >
                  <TableCell className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
                        {criteria.carrier?.name || "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-zinc-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-zinc-700 dark:text-zinc-300">
                          {criteria.guide?.name || "—"}
                        </div>
                        {criteria.product?.name && (
                          <div className="text-[9px] text-zinc-400">
                            {criteria.product.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <ConfidenceBadge
                      confidence={criteria.extraction_confidence}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <ExtractionStatusBadge
                      status={criteria.extraction_status as ExtractionStatus}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <ReviewStatusBadge
                      status={criteria.review_status as ReviewStatus}
                      isActive={criteria.is_active}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                    {criteria.extracted_at
                      ? formatSessionDate(criteria.extracted_at)
                      : "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => handleDeleteClick(criteria)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-[10px]">
                            Delete criteria
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="px-3 py-8 text-center text-[11px] text-zinc-500 dark:text-zinc-400"
                >
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {criteriaList?.length === 0
                    ? "No criteria extractions yet. Extract criteria from parsed guides."
                    : "No criteria match your filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Delete Criteria
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              Are you sure you want to delete the extracted criteria for "
              {criteriaToDelete?.carrier?.name} -{" "}
              {criteriaToDelete?.guide?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-[11px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="h-7 text-[11px] bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Criteria Dialog */}
      <CreateCriteriaDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

// Badge components

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (!confidence) {
    return <span className="text-[10px] text-zinc-400">—</span>;
  }

  const percent = Math.round(confidence * 100);
  let colorClass =
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

  if (percent >= 80) {
    colorClass =
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  } else if (percent >= 60) {
    colorClass =
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  } else if (percent > 0) {
    colorClass = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }

  return (
    <Badge className={`${colorClass} text-[9px] px-1.5 py-0`}>
      <Percent className="h-2.5 w-2.5 mr-0.5" />
      {percent}%
    </Badge>
  );
}

function ExtractionStatusBadge({ status }: { status: ExtractionStatus }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[9px] px-1.5 py-0">
          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
          Done
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] px-1.5 py-0">
          <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
          Processing
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-[9px] px-1.5 py-0">
          <XCircle className="h-2.5 w-2.5 mr-1" />
          Failed
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 text-[9px] px-1.5 py-0">
          <Clock className="h-2.5 w-2.5 mr-1" />
          Pending
        </Badge>
      );
  }
}

function ReviewStatusBadge({
  status,
  isActive,
}: {
  status: ReviewStatus | null;
  isActive?: boolean | null;
}) {
  if (isActive) {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] px-1.5 py-0">
        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
        Active
      </Badge>
    );
  }

  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[9px] px-1.5 py-0">
          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-[9px] px-1.5 py-0">
          <XCircle className="h-2.5 w-2.5 mr-1" />
          Rejected
        </Badge>
      );
    case "needs_revision":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] px-1.5 py-0">
          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
          Revision
        </Badge>
      );
    default:
      return (
        <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 text-[9px] px-1.5 py-0">
          <Clock className="h-2.5 w-2.5 mr-1" />
          Pending
        </Badge>
      );
  }
}
