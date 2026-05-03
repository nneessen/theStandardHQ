// src/features/expenses/leads/LeadPurchaseDashboard.tsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  MoreVertical,
  Eye,
  Trash2,
  TrendingUp,
  TrendingDown,
  Link2,
  ShoppingCart,
  Building2,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";
import { formatDateForDisplay } from "@/lib/date";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import {
  useLeadPurchases,
  useLeadPurchaseStats,
  useLeadStatsByVendorAggregate,
  useCreateLeadPurchaseWithExpense,
  useUpdateLeadPurchaseWithExpenseSync,
  useDeleteLeadPurchaseWithExpenseSync,
  useLeadVendors,
} from "@/hooks/lead-purchases";
import { ManageLeadPurchaseDialog } from "./ManageLeadPurchaseDialog";
import { LeadVendorDialog } from "./LeadVendorDialog";
import { VendorManagementDialog } from "./VendorManagementDialog";
import { useCreateLeadVendor } from "@/hooks/lead-purchases";
import { useImo } from "@/contexts/ImoContext";
import { toast } from "sonner";
import type {
  LeadPurchase,
  CreateLeadPurchaseData,
  LeadFreshness,
} from "@/types/lead-purchase.types";

type SortField =
  | "purchaseDate"
  | "vendor"
  | "leadCount"
  | "totalCost"
  | "roiPercentage";
type SortDirection = "asc" | "desc";

interface Filters {
  searchTerm?: string;
  vendorId?: string;
  leadFreshness?: LeadFreshness;
}

export function LeadPurchaseDashboard() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [isVendorManagementOpen, setIsVendorManagementOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<LeadPurchase | null>(
    null,
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Filters>({});

  // Sort state
  const [sortConfig, setSortConfig] = useState<{
    field: SortField;
    direction: SortDirection;
  }>({
    field: "purchaseDate",
    direction: "desc",
  });

  const { isSuperAdmin } = useImo();

  const {
    data: purchases = [],
    isLoading,
    error,
    refetch,
  } = useLeadPurchases();
  const { data: stats } = useLeadPurchaseStats();
  const { data: vendorStats = [] } = useLeadStatsByVendorAggregate();
  const { data: vendors = [] } = useLeadVendors();

  const createPurchaseWithExpense = useCreateLeadPurchaseWithExpense();
  const updatePurchase = useUpdateLeadPurchaseWithExpenseSync();
  const deletePurchase = useDeleteLeadPurchaseWithExpenseSync();
  const createVendor = useCreateLeadVendor();

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, searchTerm }));
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter and sort purchases
  const filteredPurchases = useMemo(() => {
    let result = [...purchases];

    // Apply search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.vendor?.name?.toLowerCase().includes(term) ||
          p.notes?.toLowerCase().includes(term),
      );
    }

    // Apply vendor filter
    if (filters.vendorId) {
      result = result.filter((p) => p.vendorId === filters.vendorId);
    }

    // Apply lead freshness filter
    if (filters.leadFreshness) {
      result = result.filter((p) => p.leadFreshness === filters.leadFreshness);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortConfig.field) {
        case "purchaseDate":
          comparison =
            new Date(a.purchaseDate).getTime() -
            new Date(b.purchaseDate).getTime();
          break;
        case "vendor":
          comparison = (a.vendor?.name || "").localeCompare(
            b.vendor?.name || "",
          );
          break;
        case "leadCount":
          comparison = a.leadCount - b.leadCount;
          break;
        case "totalCost":
          comparison = a.totalCost - b.totalCost;
          break;
        case "roiPercentage":
          comparison = a.roiPercentage - b.roiPercentage;
          break;
      }
      return sortConfig.direction === "desc" ? -comparison : comparison;
    });

    return result;
  }, [purchases, filters, sortConfig]);

  // Pagination
  const totalItems = filteredPurchases.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, currentPage, pageSize]);

  // Pagination helpers
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) setCurrentPage(page);
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1);
  }, [currentPage, totalPages]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  }, [currentPage]);

  const toggleSort = useCallback((field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchTerm("");
    setCurrentPage(1);
  }, []);

  const filterCount = Object.entries(filters).filter(
    ([key, value]) =>
      key !== "searchTerm" && value !== undefined && value !== "",
  ).length;

  const handleSave = async (data: CreateLeadPurchaseData) => {
    try {
      if (selectedPurchase) {
        await updatePurchase.mutateAsync({ id: selectedPurchase.id, data });
        toast.success(
          selectedPurchase.expenseId
            ? "Lead purchase + expense updated!"
            : "Lead purchase updated!",
        );
      } else {
        await createPurchaseWithExpense.mutateAsync(data);
        toast.success("Lead purchase + expense added!");
      }
      setIsDialogOpen(false);
      setSelectedPurchase(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save purchase",
      );
    }
  };

  const handleDelete = async (purchase: LeadPurchase) => {
    if (confirm("Delete this lead purchase?")) {
      try {
        await deletePurchase.mutateAsync(purchase.id);
        toast.success(
          purchase.expenseId
            ? "Lead purchase + expense deleted!"
            : "Lead purchase deleted!",
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete",
        );
      }
    }
  };

  const handleAddVendor = async (data: { name: string }) => {
    try {
      await createVendor.mutateAsync(data);
      setIsVendorDialogOpen(false);
      toast.success("Vendor added!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add vendor",
      );
    }
  };

  // Get top 3 vendors for metrics bar
  const topVendors = vendorStats.slice(0, 3);

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden bg-card rounded-v2-md border border-border shadow-v2-soft">
        {/* Header with Title */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-foreground" />
            <h1 className="text-sm font-semibold text-foreground">
              Lead Purchases
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                >
                  <Building2 className="h-3 w-3 mr-1" />
                  Vendors
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => setIsVendorDialogOpen(true)}
                  className="text-[11px]"
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Add Vendor
                </DropdownMenuItem>
                {isSuperAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setIsVendorManagementOpen(true)}
                      className="text-[11px]"
                    >
                      <Settings className="mr-2 h-3.5 w-3.5" />
                      Manage Vendors
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => {
                setSelectedPurchase(null);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Purchase
            </Button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border text-[11px]">
          {stats ? (
            <>
              {/* Lead metrics */}
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">
                  {stats.totalLeads.toLocaleString()}
                </span>
                <span className="text-muted-foreground">leads</span>
              </div>
              <div className="h-3 w-px bg-muted" />

              {/* Spend metrics */}
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">
                  {formatCurrency(stats.totalSpent)}
                </span>
                <span className="text-muted-foreground">spent</span>
              </div>
              <div className="h-3 w-px bg-muted" />

              {/* Cost per lead */}
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">
                  ${stats.avgCostPerLead.toFixed(2)}
                </span>
                <span className="text-muted-foreground">/lead</span>
              </div>
              <div className="h-3 w-px bg-muted" />

              {/* Conversion */}
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="font-medium text-foreground">
                  {stats.totalPolicies}
                </span>
                <span className="text-muted-foreground">
                  sold ({formatPercent(stats.conversionRate)})
                </span>
              </div>
              <div className="h-3 w-px bg-muted" />

              {/* ROI */}
              <div className="flex items-center gap-1">
                {stats.avgRoi >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span
                  className={cn(
                    "font-medium",
                    stats.avgRoi >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {stats.avgRoi >= 0 ? "+" : ""}
                  {stats.avgRoi.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">ROI</span>
              </div>
              <div className="h-3 w-px bg-muted" />

              {/* Commission earned */}
              <div className="flex items-center gap-1">
                <span className="font-medium text-success">
                  {formatCurrency(stats.totalCommission)}
                </span>
                <span className="text-muted-foreground">earned</span>
              </div>

              {filterCount > 0 && (
                <>
                  <div className="h-3 w-px bg-muted" />
                  <span className="text-[9px] px-1.5 py-0.5 bg-info/10 text-info rounded">
                    {filterCount} filter{filterCount > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </>
          ) : (
            <div className="text-muted-foreground">Loading metrics...</div>
          )}
        </div>

        {/* Team Vendor Performance Bar */}
        {topVendors.length > 0 && (
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border text-[10px] bg-warning/10">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              <span className="text-warning font-semibold uppercase tracking-[0.18em]">
                Team Insights
              </span>
              <span className="text-warning/70 ml-1">
                Top performing vendors across the organization:
              </span>
            </div>
            <div className="h-3 w-px bg-warning" />
            {topVendors.map((vendor, idx) => (
              <div key={vendor.vendorId} className="flex items-center gap-1">
                {idx > 0 && <div className="h-2.5 w-px bg-warning/30" />}
                <span className="font-semibold text-foreground ml-1">
                  {vendor.vendorName}
                </span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    vendor.avgRoi >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {vendor.avgRoi >= 0 ? "+" : ""}
                  {vendor.avgRoi.toFixed(0)}%
                </span>
                <span className="text-muted-foreground">
                  ({vendor.uniqueUsers} user
                  {vendor.uniqueUsers !== 1 ? "s" : ""}, {vendor.totalLeads}{" "}
                  leads)
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border">
          <div className="flex-1 relative flex items-center">
            <Search
              size={14}
              className="absolute left-2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Search by vendor or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-6 pl-7 text-[10px] bg-card border-border"
            />
          </div>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? "default" : "ghost"}
            size="sm"
            className="h-6 text-[10px] px-2"
          >
            <Filter size={12} className="mr-1" />
            Filters
          </Button>
          {filterCount > 0 && (
            <Button
              onClick={clearFilters}
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2 text-muted-foreground"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border">
            <Select
              value={filters.vendorId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  vendorId: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger className="h-6 w-[140px] text-[10px] bg-card border-border">
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.leadFreshness || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  leadFreshness:
                    value === "all" ? undefined : (value as LeadFreshness),
                })
              }
            >
              <SelectTrigger className="h-6 w-[100px] text-[10px] bg-card border-border">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="fresh">Fresh</SelectItem>
                <SelectItem value="aged">Aged</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Table Container - Scrollable */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="h-8 border-b border-border hover:bg-transparent">
                <TableHead
                  className="text-[10px] font-semibold text-muted-foreground px-2 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort("purchaseDate")}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {sortConfig.field === "purchaseDate" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="text-[10px] font-semibold text-muted-foreground px-2 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort("vendor")}
                >
                  <div className="flex items-center gap-1">
                    Vendor
                    {sortConfig.field === "vendor" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </div>
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground px-2">
                  Type
                </TableHead>
                <TableHead
                  className="text-[10px] font-semibold text-muted-foreground px-2 text-right cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort("leadCount")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Leads
                    {sortConfig.field === "leadCount" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="text-[10px] font-semibold text-muted-foreground px-2 text-right cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort("totalCost")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Cost
                    {sortConfig.field === "totalCost" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </div>
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground px-2 text-right">
                  $/Lead
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground px-2 text-right">
                  Sold
                </TableHead>
                <TableHead
                  className="text-[10px] font-semibold text-muted-foreground px-2 text-right cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort("roiPercentage")}
                >
                  <div className="flex items-center justify-end gap-1">
                    ROI
                    {sortConfig.field === "roiPercentage" &&
                      (sortConfig.direction === "asc" ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </div>
                </TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground px-2 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <LogoSpinner size="xl" className="mr-2" />
                    Loading purchases...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                      <span className="text-[11px] text-destructive">
                        Error:{" "}
                        {error instanceof Error ? error.message : String(error)}
                      </span>
                      <Button
                        onClick={() => refetch()}
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2"
                      >
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedPurchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center p-4">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-[11px] text-muted-foreground">
                        {filterCount > 0 || searchTerm
                          ? "No purchases match your filters"
                          : "No lead purchases yet"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Click "Add Purchase" to get started
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPurchases.map((purchase) => (
                  <TableRow
                    key={purchase.id}
                    className="h-9 border-b border-border/60 hover:bg-background transition-colors"
                  >
                    <TableCell className="text-[11px] text-muted-foreground py-1.5 px-2 font-mono">
                      {formatDateForDisplay(purchase.purchaseDate, {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 px-2">
                      <span className="font-medium text-foreground">
                        {purchase.vendor?.name || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 px-2">
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded font-medium",
                          purchase.leadFreshness === "fresh"
                            ? "bg-info/10 text-info"
                            : "bg-accent/40 text-warning",
                        )}
                      >
                        {purchase.leadFreshness === "fresh" ? "Fresh" : "Aged"}
                      </span>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 px-2 text-right tabular-nums font-mono text-foreground">
                      {purchase.leadCount}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 px-2 text-right tabular-nums">
                      <span className="text-foreground">
                        {formatCurrency(purchase.totalCost)}
                      </span>
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 px-2 text-right tabular-nums font-mono text-muted-foreground">
                      ${purchase.costPerLead.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 px-2 text-right tabular-nums font-mono text-foreground">
                      {purchase.policiesSold}
                    </TableCell>
                    <TableCell className="text-[11px] py-1.5 px-2 text-right tabular-nums">
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          purchase.roiPercentage >= 0
                            ? "text-success"
                            : "text-destructive",
                        )}
                      >
                        {purchase.roiPercentage >= 0 ? "+" : ""}
                        {purchase.roiPercentage.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 px-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedPurchase(purchase);
                              setIsDialogOpen(true);
                            }}
                            className="text-[11px]"
                          >
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            View / Manage
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedPurchase(purchase);
                              setIsDialogOpen(true);
                            }}
                            className="text-[11px] text-info"
                          >
                            <Link2 className="mr-2 h-3.5 w-3.5" />
                            Link Policies
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(purchase)}
                            className="text-destructive text-[11px]"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete Purchase
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </span>
              -
              <span className="font-medium text-foreground">
                {Math.min(currentPage * pageSize, totalItems)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{totalItems}</span>
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-6 w-[80px] text-[10px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
                <SelectItem value="100">100 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>

            <Button
              onClick={previousPage}
              disabled={currentPage === 1}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <div className="flex items-center gap-0.5">
              {(() => {
                const pages = [];
                const maxVisible = 5;
                let start = Math.max(
                  1,
                  currentPage - Math.floor(maxVisible / 2),
                );
                const end = Math.min(totalPages, start + maxVisible - 1);

                if (end - start < maxVisible - 1) {
                  start = Math.max(1, end - maxVisible + 1);
                }

                if (start > 1) {
                  pages.push(
                    <Button
                      key={1}
                      onClick={() => goToPage(1)}
                      variant="ghost"
                      size="sm"
                      className="h-6 min-w-6 px-1.5 text-[10px] text-muted-foreground"
                    >
                      1
                    </Button>,
                  );
                  if (start > 2) {
                    pages.push(
                      <span
                        key="dots1"
                        className="px-0.5 text-muted-foreground text-[10px]"
                      >
                        ...
                      </span>,
                    );
                  }
                }

                for (let i = start; i <= end; i++) {
                  pages.push(
                    <Button
                      key={i}
                      onClick={() => goToPage(i)}
                      variant={currentPage === i ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-6 min-w-6 px-1.5 text-[10px]",
                        currentPage !== i && "text-muted-foreground",
                      )}
                    >
                      {i}
                    </Button>,
                  );
                }

                if (end < totalPages) {
                  if (end < totalPages - 1) {
                    pages.push(
                      <span
                        key="dots2"
                        className="px-0.5 text-muted-foreground text-[10px]"
                      >
                        ...
                      </span>,
                    );
                  }
                  pages.push(
                    <Button
                      key={totalPages}
                      onClick={() => goToPage(totalPages)}
                      variant="ghost"
                      size="sm"
                      className="h-6 min-w-6 px-1.5 text-[10px] text-muted-foreground"
                    >
                      {totalPages}
                    </Button>,
                  );
                }

                return pages;
              })()}
            </div>

            <Button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            <Button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <ManageLeadPurchaseDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedPurchase(null);
        }}
        purchase={selectedPurchase}
        onSave={handleSave}
        isLoading={
          createPurchaseWithExpense.isPending || updatePurchase.isPending
        }
      />

      <LeadVendorDialog
        open={isVendorDialogOpen}
        onOpenChange={setIsVendorDialogOpen}
        onSave={handleAddVendor}
        isLoading={createVendor.isPending}
      />

      {isSuperAdmin && (
        <VendorManagementDialog
          open={isVendorManagementOpen}
          onOpenChange={setIsVendorManagementOpen}
        />
      )}
    </>
  );
}
