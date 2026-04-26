import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as Chev,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UserProfile } from "@/types/hierarchy.types";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useActiveTemplate,
  usePhases,
  useRecruitsChecklistSummary,
} from "@/features/recruiting";
import { TERMINAL_STATUS_COLORS } from "@/types/recruiting.types";
import { cn } from "@/lib/utils";

type RecruitWithRelations = UserProfile & {
  recruiter?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
  } | null;
  upline?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
  } | null;
  pipeline_template?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  pipeline_template_id?: string | null;
};

interface RecruitListTableProps {
  recruits: UserProfile[];
  isLoading?: boolean;
  selectedRecruitId?: string;
  onSelectRecruit: (recruit: UserProfile) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const headerCellCls =
  "text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 dark:text-zinc-400";

export function RecruitListTable({
  recruits,
  isLoading,
  selectedRecruitId,
  onSelectRecruit,
}: RecruitListTableProps) {
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [recruiterFilter, setRecruiterFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: activeTemplate } = useActiveTemplate();
  const { data: phases = [] } = usePhases(activeTemplate?.id);

  const recruiters = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    recruits.forEach((r) => {
      const recruit = r as RecruitWithRelations;
      if (recruit.recruiter?.id) {
        const name =
          recruit.recruiter.first_name && recruit.recruiter.last_name
            ? `${recruit.recruiter.first_name} ${recruit.recruiter.last_name}`
            : recruit.recruiter.email.split("@")[0];
        map.set(recruit.recruiter.id, { id: recruit.recruiter.id, name });
      }
    });
    return Array.from(map.values());
  }, [recruits]);

  const filteredRecruits = useMemo(() => {
    return recruits.filter((r) => {
      const recruit = r as RecruitWithRelations;
      if (
        phaseFilter !== "all" &&
        recruit.current_onboarding_phase !== phaseFilter
      )
        return false;
      if (
        recruiterFilter !== "all" &&
        recruit.recruiter?.id !== recruiterFilter
      )
        return false;
      return true;
    });
  }, [recruits, phaseFilter, recruiterFilter]);

  const totalPages = Math.ceil(filteredRecruits.length / pageSize);
  const paginatedRecruits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecruits.slice(start, start + pageSize);
  }, [filteredRecruits, currentPage, pageSize]);

  const paginatedRecruitIds = useMemo(
    () => paginatedRecruits.map((r) => r.id),
    [paginatedRecruits],
  );
  const { data: checklistSummary } =
    useRecruitsChecklistSummary(paginatedRecruitIds);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [phaseFilter, recruiterFilter, pageSize]);

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-full bg-zinc-200/70 dark:bg-zinc-800/70"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Filter row */}
      <div className="flex items-center gap-2 sm:gap-3 py-2 flex-wrap">
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="h-7 w-[130px] text-[11px] bg-transparent border-zinc-200 dark:border-zinc-800">
            <SelectValue placeholder="Phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All phases
            </SelectItem>
            {phases && phases.length > 0
              ? phases
                  .sort(
                    (a: { phase_order: number }, b: { phase_order: number }) =>
                      a.phase_order - b.phase_order,
                  )
                  .map((phase: { id: string; phase_name: string }) => (
                    <SelectItem
                      key={phase.id}
                      value={phase.phase_name}
                      className="text-[11px]"
                    >
                      {phase.phase_name}
                    </SelectItem>
                  ))
              : Array.from(
                  new Set(
                    recruits
                      .map((r) => r.current_onboarding_phase)
                      .filter(Boolean),
                  ),
                ).map((phase) => (
                  <SelectItem
                    key={phase}
                    value={phase!}
                    className="text-[11px]"
                  >
                    {phase}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>

        <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
          <SelectTrigger className="h-7 w-[140px] text-[11px] bg-transparent border-zinc-200 dark:border-zinc-800">
            <SelectValue placeholder="Recruiter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All recruiters
            </SelectItem>
            {recruiters.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-[11px]">
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-[11px] italic text-zinc-500 dark:text-zinc-400 ml-auto">
          {filteredRecruits.length} recruit
          {filteredRecruits.length === 1 ? "" : "s"} shown
        </span>
      </div>

      {/* Mobile card list */}
      <ul className="md:hidden flex flex-col">
        {paginatedRecruits.length === 0 && (
          <li className="border-t border-zinc-200 dark:border-zinc-800 py-10 text-center">
            <Users className="h-6 w-6 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
            <p className="text-[12px] italic text-zinc-500 dark:text-zinc-400">
              {filteredRecruits.length === 0 && recruits.length > 0
                ? "No recruits match your filters."
                : "No recruits yet."}
            </p>
          </li>
        )}
        {paginatedRecruits.map((recruit) => {
          const summary = checklistSummary?.get(recruit.id);
          const phaseName = recruit.current_onboarding_phase || "Not started";
          const pct =
            summary && summary.totalItems > 0
              ? Math.round((summary.completedItems / summary.totalItems) * 100)
              : 0;
          const isTerminal =
            recruit.onboarding_status === "completed" ||
            recruit.onboarding_status === "dropped" ||
            recruit.onboarding_status === "withdrawn";
          return (
            <li
              key={recruit.id}
              className={cn("border-t border-zinc-200 dark:border-zinc-800")}
            >
              <button
                type="button"
                onClick={() => onSelectRecruit(recruit)}
                className={cn(
                  "w-full flex items-center gap-3 py-3 px-1 text-left hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors",
                  selectedRecruitId === recruit.id &&
                    "bg-zinc-100 dark:bg-zinc-800/60",
                )}
              >
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={recruit.profile_photo_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {(recruit.first_name?.[0] || "").toUpperCase()}
                    {(recruit.last_name?.[0] || "").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                    {recruit.first_name && recruit.last_name
                      ? `${recruit.first_name} ${recruit.last_name}`
                      : recruit.email?.split("@")[0] || "Unknown"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {isTerminal ? (
                      <span
                        className={cn(
                          "uppercase tracking-[0.18em] font-semibold",
                          TERMINAL_STATUS_COLORS[recruit.onboarding_status!] ||
                            "",
                        )}
                      >
                        {recruit.onboarding_status?.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <>
                        <span className="italic">{phaseName}</span>
                        {summary && summary.totalItems > 0 && (
                          <span className="ml-2 font-mono tabular-nums">
                            {summary.completedItems}/{summary.totalItems} ·{" "}
                            {pct}%
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <Chev className="h-4 w-4 text-zinc-400 flex-shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-transparent">
              <TableHead className={cn(headerCellCls, "w-12")}> </TableHead>
              <TableHead className={headerCellCls}>Name</TableHead>
              <TableHead className={headerCellCls}>Email</TableHead>
              <TableHead className={cn(headerCellCls, "w-[120px]")}>
                Phone
              </TableHead>
              <TableHead className={cn(headerCellCls, "w-[200px]")}>
                Progress
              </TableHead>
              <TableHead className={headerCellCls}>Recruiter</TableHead>
              <TableHead className={cn(headerCellCls, "w-14 text-center")}>
                Days
              </TableHead>
              <TableHead className={cn(headerCellCls, "w-20")}>
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRecruits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <div className="flex flex-col items-center">
                    <Users className="h-7 w-7 text-zinc-300 dark:text-zinc-700 mb-3" />
                    <p className="text-[12px] italic text-zinc-500 dark:text-zinc-400">
                      {filteredRecruits.length === 0 && recruits.length > 0
                        ? "No recruits match your filters."
                        : "No recruits yet — send an invite or add one to start your pipeline."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRecruits.map((recruit) => {
                const recruitWithRelations = recruit as RecruitWithRelations;
                const createdDate = new Date(
                  recruit.created_at || new Date().toISOString(),
                );
                const updatedDate = new Date(
                  recruit.updated_at ||
                    recruit.created_at ||
                    new Date().toISOString(),
                );
                const daysInPipeline = Math.floor(
                  (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
                );
                const summary = checklistSummary?.get(recruit.id);
                const phaseName =
                  recruit.current_onboarding_phase || "Not started";
                const pct =
                  summary && summary.totalItems > 0
                    ? Math.round(
                        (summary.completedItems / summary.totalItems) * 100,
                      )
                    : 0;
                const isTerminal =
                  recruit.onboarding_status === "completed" ||
                  recruit.onboarding_status === "dropped" ||
                  recruit.onboarding_status === "withdrawn";
                return (
                  <TableRow
                    key={recruit.id}
                    onClick={() => onSelectRecruit(recruit)}
                    className={cn(
                      "cursor-pointer border-b border-zinc-100 dark:border-zinc-900 transition-colors",
                      selectedRecruitId === recruit.id
                        ? "bg-zinc-100 dark:bg-zinc-800/60"
                        : "hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40",
                    )}
                  >
                    <TableCell className="py-2 align-middle">
                      <Avatar className="h-7 w-7">
                        <AvatarImage
                          src={recruit.profile_photo_url || undefined}
                        />
                        <AvatarFallback className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {(recruit.first_name?.[0] || "").toUpperCase()}
                          {(recruit.last_name?.[0] || "").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="py-2 text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                      {recruit.first_name && recruit.last_name
                        ? `${recruit.first_name} ${recruit.last_name}`
                        : recruit.email?.split("@")[0] || "Unknown"}
                    </TableCell>
                    <TableCell className="py-2 text-[12px] text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]">
                      {recruit.email || "—"}
                    </TableCell>
                    <TableCell className="py-2 text-[12px] font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                      {recruit.phone || "—"}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {isTerminal ? (
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.16em] font-bold ring-1",
                            recruit.onboarding_status === "completed"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-900"
                              : recruit.onboarding_status === "dropped"
                                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-900"
                                : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 ring-stone-200 dark:ring-stone-700",
                          )}
                        >
                          {recruit.onboarding_status?.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-stone-800 dark:text-stone-200 truncate">
                              {phaseName}
                            </div>
                            {summary && summary.totalItems > 0 && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 h-1 bg-stone-200 dark:bg-stone-800 rounded-full relative overflow-hidden">
                                  <div
                                    className="absolute inset-y-0 left-0 bg-amber-500 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono tabular-nums text-stone-500 dark:text-stone-400">
                                  {summary.completedItems}/{summary.totalItems}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-[12px] text-zinc-600 dark:text-zinc-400">
                      {recruitWithRelations.recruiter?.first_name
                        ? `${recruitWithRelations.recruiter.first_name[0]}. ${
                            recruitWithRelations.recruiter.last_name || ""
                          }`
                        : recruitWithRelations.recruiter?.email?.split(
                            "@",
                          )[0] || "—"}
                    </TableCell>
                    <TableCell className="py-2 text-[12px] font-mono tabular-nums text-center text-zinc-600 dark:text-zinc-400">
                      {daysInPipeline}
                    </TableCell>
                    <TableCell className="py-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                      {formatDistanceToNow(updatedDate, { addSuffix: false })
                        .replace("about ", "")
                        .replace(" days", "d")
                        .replace(" day", "d")
                        .replace(" hours", "h")
                        .replace(" hour", "h")
                        .replace(" minutes", "m")
                        .replace(" minute", "m")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-200 dark:border-zinc-800 py-2 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 dark:text-zinc-400">
            Show
          </span>
          <Select
            value={pageSize.toString()}
            onValueChange={(val) => setPageSize(parseInt(val))}
          >
            <SelectTrigger className="h-6 w-[60px] text-[11px] bg-transparent border-zinc-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem
                  key={size}
                  value={size.toString()}
                  className="text-[11px]"
                >
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center disabled:opacity-30 disabled:cursor-not-allowed hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-mono tabular-nums">
            {currentPage} / {totalPages || 1}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="inline-flex items-center disabled:opacity-30 disabled:cursor-not-allowed hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 dark:text-zinc-400">
          {paginatedRecruits.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
          {Math.min(currentPage * pageSize, filteredRecruits.length)} of{" "}
          {filteredRecruits.length}
        </span>
      </div>
    </div>
  );
}
