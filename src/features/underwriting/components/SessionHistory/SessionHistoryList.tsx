// src/features/underwriting/components/SessionHistory/SessionHistoryList.tsx

import { useState, useDeferredValue } from "react";
import {
  Eye,
  Calendar,
  User,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserSessionsPaginated } from "../../hooks/sessions/useUnderwritingSessions";
import { SessionDetailDialog } from "./SessionDetailDialog";
import type { UnderwritingSession } from "../../types/underwriting.types";
import { getHealthTierLabel } from "../../types/underwriting.types";
import {
  formatSessionDate,
  getHealthTierBadgeColor,
  isValidHealthTier,
} from "../../utils/shared/formatters";
import { formatRequestedFaceAmounts } from "../../utils/sessions/session-persistence";

const PAGE_SIZE = 20;

export function SessionHistoryList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const deferredSearch = useDeferredValue(search);

  const {
    data: result,
    isLoading,
    error,
    isFetching,
  } = useUserSessionsPaginated(page, PAGE_SIZE, deferredSearch);

  const sessions = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const [selectedSession, setSelectedSession] =
    useState<UnderwritingSession | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleViewSession = (session: UnderwritingSession) => {
    setSelectedSession(session);
    setDetailOpen(true);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  if (error) {
    return (
      <div className="text-center py-8 text-red-500 dark:text-red-400 text-[11px]">
        Failed to load sessions: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
            Session History
          </h3>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {totalCount} session{totalCount !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name, state, health tier..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 dark:bg-zinc-800/50">
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Date
                </div>
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Client
                </div>
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-3 w-3" />
                  Health Tier
                </div>
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                Face Amounts
              </TableHead>
              <TableHead className="h-8 px-3 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 w-[80px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <Skeleton className="h-5 w-20 mx-auto" />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-6 w-14" />
                  </TableCell>
                </TableRow>
              ))
            ) : sessions.length > 0 ? (
              sessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer"
                  onClick={() => handleViewSession(session)}
                >
                  <TableCell className="px-3 py-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                    {formatSessionDate(session.created_at)}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div>
                      <div className="text-[11px] text-zinc-900 dark:text-zinc-100 font-medium">
                        {session.client_name || "Unnamed Client"}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {session.client_age} y/o {session.client_gender} •{" "}
                        {session.client_state}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <Badge
                      className={`text-[9px] px-1.5 py-0 ${getHealthTierBadgeColor(session.health_tier)}`}
                    >
                      {isValidHealthTier(session.health_tier)
                        ? getHealthTierLabel(session.health_tier)
                        : "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-[11px] text-zinc-700 dark:text-zinc-300 text-right font-medium">
                    {formatRequestedFaceAmounts(session)}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSession(session);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="px-3 py-8 text-center text-[11px] text-zinc-500 dark:text-zinc-400"
                >
                  {search
                    ? "No sessions match your search."
                    : "No sessions found. Run the underwriting wizard to create your first session."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={page >= totalPages - 1 || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Session Detail Dialog */}
      <SessionDetailDialog
        session={selectedSession}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
