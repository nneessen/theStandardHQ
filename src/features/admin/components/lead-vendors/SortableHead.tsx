// src/features/admin/components/lead-vendors/SortableHead.tsx

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

interface SortableHeadProps<T extends string> {
  field: T;
  label: string;
  handleSort: (f: T) => void;
  sortField: T;
  sortDir: SortDir;
  className?: string;
}

export function SortableHead<T extends string>({
  field,
  label,
  handleSort,
  sortField,
  sortDir,
  className,
}: SortableHeadProps<T>) {
  const isActive = sortField === field;
  return (
    <TableHead
      className={cn(
        "text-[10px] font-semibold p-1.5 cursor-pointer select-none hover:bg-v2-ring dark:hover:bg-v2-card-dark/50 transition-colors",
        className,
      )}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {isActive ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-2.5 w-2.5 text-v2-ink-muted" />
          ) : (
            <ArrowDown className="h-2.5 w-2.5 text-v2-ink-muted" />
          )
        ) : (
          <ArrowUpDown className="h-2.5 w-2.5 text-v2-ink-subtle" />
        )}
      </span>
    </TableHead>
  );
}
