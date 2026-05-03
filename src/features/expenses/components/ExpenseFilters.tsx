// src/features/expenses/components/ExpenseFilters.tsx

import { useState } from "react";
import { Search, X, Filter } from "lucide-react";
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
import type { ExpenseFilters as ExpenseFiltersType } from "@/types/expense.types";

interface ExpenseFiltersProps {
  filters: ExpenseFiltersType;
  onFiltersChange: (filters: ExpenseFiltersType) => void;
  categories: string[];
}

export function ExpenseFilters({
  filters,
  onFiltersChange,
  categories,
}: ExpenseFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleClearFilters = () => {
    onFiltersChange({
      expenseType: "all",
      category: "all",
      searchTerm: "",
      deductibleOnly: false,
    });
  };

  const hasActiveFilters =
    filters.expenseType !== "all" ||
    filters.category !== "all" ||
    filters.searchTerm ||
    filters.deductibleOnly ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={filters.searchTerm || ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, searchTerm: e.target.value })
            }
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? "bg-accent" : ""}
        >
          <Filter className="h-4 w-4" />
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={handleClearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="grid gap-4 rounded-lg bg-gradient-to-br from-accent/10 to-card shadow-md p-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Expense Type */}
          <div className="space-y-2">
            <Label>Expense Type</Label>
            <Select
              value={filters.expenseType || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  expenseType: value as "personal" | "business" | "all",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={filters.category || "all"}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={filters.startDate || ""}
              onChange={(e) =>
                onFiltersChange({ ...filters, startDate: e.target.value })
              }
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={filters.endDate || ""}
              onChange={(e) =>
                onFiltersChange({ ...filters, endDate: e.target.value })
              }
            />
          </div>

          {/* Tax Deductible Only */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="deductibleOnly"
              checked={filters.deductibleOnly || false}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  deductibleOnly: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="deductibleOnly" className="cursor-pointer">
              Tax Deductible Only
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}
