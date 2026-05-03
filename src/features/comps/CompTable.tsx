// src/features/comps/CompTable.tsx

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Building2,
  Package,
  Percent,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Comp } from "../../types/commission.types";
import { parseLocalDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
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

interface CompTableProps {
  data: Comp[];
  isLoading: boolean;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pagination state type
  onPaginationChange?: (newPagination: any) => void;
}

type SortField =
  | "carrier_id"
  | "product_type"
  | "commission_percentage"
  | "contract_level";
type SortOrder = "asc" | "desc";

export function CompTable({ data, isLoading, error }: CompTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<SortField>("carrier_id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Sort data (React 19 doesn't need useMemo)
  const sortedData = !data
    ? []
    : [...data].sort((a, b) => {
        let aVal: string | number | null = a[sortBy];
        let bVal: string | number | null = b[sortBy];

        // Handle null values - sort nulls to the end
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;

        if (typeof aVal === "string") aVal = aVal.toLowerCase();
        if (typeof bVal === "string") bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });

  // Client-side pagination (React 19 doesn't need useMemo)
  const startIndex = (page - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const totalPages = Math.ceil((data?.length || 0) / pageSize);
  const total = data?.length || 0;

  const handleSort = (field: SortField) => {
    const newOrder = sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(newOrder);
    setPage(1); // Reset to first page when sorting
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value));
    setPage(1); // Reset to first page when changing page size
  };

  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  const formatCommissionRate = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  const renderPagination = () => {
    if (!data || data.length === 0) return null;

    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, total);

    return (
      <div className="bg-gradient-to-r from-card to-muted/20 shadow-sm px-4 py-3 flex items-center justify-between sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            variant="outline"
            size="sm"
          >
            Previous
          </Button>
          <Button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            variant="outline"
            size="sm"
            className="ml-3"
          >
            Next
          </Button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{startItem}</span> to{" "}
              <span className="font-medium">{endItem}</span> of{" "}
              <span className="font-medium">{total}</span> results
            </p>
            <div className="flex items-center space-x-2">
              <label
                htmlFor="pageSize"
                className="text-sm text-muted-foreground"
              >
                Per page:
              </label>
              <Select
                value={pageSize.toString()}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <nav
              className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              aria-label="Pagination"
            >
              <Button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                variant="outline"
                size="icon"
                className="rounded-l-md rounded-r-none"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    variant="outline"
                    size="sm"
                    className={`rounded-none ${
                      pageNum === page
                        ? "z-10 bg-primary/10 border-primary text-primary"
                        : ""
                    }`}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                variant="outline"
                size="icon"
                className="rounded-r-md rounded-l-none"
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Error Loading Comp Data
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {error ||
            "An unexpected error occurred while loading the comp guide."}
        </p>
        <Button onClick={() => window.location.reload()} size="sm">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card shadow-md overflow-hidden sm:rounded-md">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("carrier_id")}
              >
                <div className="flex items-center">
                  <Building2 className="h-4 w-4 mr-2" />
                  Carrier
                  {getSortIcon("carrier_id")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("product_type")}
              >
                <div className="flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Product
                  {getSortIcon("product_type")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("contract_level")}
              >
                <div className="flex items-center">
                  Contract Level
                  {getSortIcon("contract_level")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("commission_percentage")}
              >
                <div className="flex items-center">
                  <Percent className="h-4 w-4 mr-2" />
                  Commission Rate
                  {getSortIcon("commission_percentage")}
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Effective Date
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                    <span className="text-muted-foreground">
                      Loading comp data...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="text-muted-foreground">
                    <Package className="mx-auto h-12 w-12 mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No Comp Data Found
                    </h3>
                    <p className="text-sm">
                      Try adjusting your search filters or check back later.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((record) => {
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {record.carrier_id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {record.product_type
                            .split("_")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1),
                            )
                            .join(" ")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {record.product_type}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-lg font-semibold text-foreground">
                        {record.contract_level}%
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-lg font-semibold text-primary">
                        {formatCommissionRate(record.commission_percentage)}
                      </div>
                      {record.bonus_percentage && (
                        <div className="text-xs text-success">
                          +{record.bonus_percentage}% bonus
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {parseLocalDate(
                        record.effective_date,
                      ).toLocaleDateString()}
                      {record.expiration_date && (
                        <div className="text-xs text-muted-foreground/70">
                          Expires:{" "}
                          {parseLocalDate(
                            record.expiration_date,
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {paginatedData.length > 0 && renderPagination()}
    </div>
  );
}

export default CompTable;
