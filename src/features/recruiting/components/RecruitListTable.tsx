import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as Chev,
  Users,
  UserPlus,
  XCircle,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UserProfile } from "@/types/hierarchy.types";
import {
  STATUS_COLORS,
  type EnrichedLead,
  type LeadStatus,
} from "@/types/leads.types";
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
import { Button } from "@/components/ui/button";
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

export type RecruitingRow =
  | { kind: "recruit"; recruit: UserProfile }
  | { kind: "lead"; lead: EnrichedLead };

interface RecruitListTableProps {
  rows: RecruitingRow[];
  isLoading?: boolean;
  selectedRecruitId?: string;
  selectedLeadId?: string;
  onSelectRecruit: (recruit: UserProfile) => void;
  onSelectLead?: (lead: EnrichedLead) => void;
  onAcceptLead?: (lead: EnrichedLead) => void;
  onRejectLead?: (lead: EnrichedLead) => void;
  isAcceptingLead?: boolean;
  isRejectingLead?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const headerCellCls =
  "text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground";

function leadInitials(lead: EnrichedLead) {
  const f = (lead.first_name?.[0] || "").toUpperCase();
  const l = (lead.last_name?.[0] || "").toUpperCase();
  return f + l || "?";
}

function recruitInitials(recruit: UserProfile) {
  const f = (recruit.first_name?.[0] || "").toUpperCase();
  const l = (recruit.last_name?.[0] || "").toUpperCase();
  return f + l;
}

export function RecruitListTable({
  rows,
  isLoading,
  selectedRecruitId,
  selectedLeadId,
  onSelectRecruit,
  onSelectLead,
  onAcceptLead,
  onRejectLead,
  isAcceptingLead,
  isRejectingLead,
}: RecruitListTableProps) {
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [recruiterFilter, setRecruiterFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: activeTemplate } = useActiveTemplate();
  const { data: phases = [] } = usePhases(activeTemplate?.id);

  const recruitRows = useMemo(
    () =>
      rows.filter(
        (r): r is Extract<RecruitingRow, { kind: "recruit" }> =>
          r.kind === "recruit",
      ),
    [rows],
  );
  const leadRows = useMemo(
    () =>
      rows.filter(
        (r): r is Extract<RecruitingRow, { kind: "lead" }> => r.kind === "lead",
      ),
    [rows],
  );

  const recruiters = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    recruitRows.forEach((row) => {
      const recruit = row.recruit as RecruitWithRelations;
      if (recruit.recruiter?.id) {
        const name =
          recruit.recruiter.first_name && recruit.recruiter.last_name
            ? `${recruit.recruiter.first_name} ${recruit.recruiter.last_name}`
            : recruit.recruiter.email.split("@")[0];
        map.set(recruit.recruiter.id, { id: recruit.recruiter.id, name });
      }
    });
    return Array.from(map.values());
  }, [recruitRows]);

  // Phase + recruiter filters apply to recruit rows only.
  // Pending leads stay visible at the top regardless of filter state.
  const filteredRecruitRows = useMemo(() => {
    return recruitRows.filter((row) => {
      const recruit = row.recruit as RecruitWithRelations;
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
  }, [recruitRows, phaseFilter, recruiterFilter]);

  const visibleRows = useMemo<RecruitingRow[]>(
    () => [...leadRows, ...filteredRecruitRows],
    [leadRows, filteredRecruitRows],
  );

  const totalPages = Math.ceil(visibleRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, currentPage, pageSize]);

  const paginatedRecruitIds = useMemo(
    () =>
      paginatedRows
        .filter(
          (r): r is Extract<RecruitingRow, { kind: "recruit" }> =>
            r.kind === "recruit",
        )
        .map((r) => r.recruit.id),
    [paginatedRows],
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
          <Skeleton key={i} className="h-10 w-full bg-muted/70 /70" />
        ))}
      </div>
    );
  }

  const pendingLeadStatus: LeadStatus = "pending";
  const leadBadgeCls = cn(
    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.16em] font-bold ring-1",
    STATUS_COLORS[pendingLeadStatus].bg,
    STATUS_COLORS[pendingLeadStatus].text,
    "ring-warning/30",
  );

  return (
    <div className="flex flex-col">
      {/* Filter row */}
      <div className="flex items-center gap-2 sm:gap-3 py-2 flex-wrap">
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="h-7 w-[130px] text-[11px] bg-transparent border-border">
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
                    recruitRows
                      .map((row) => row.recruit.current_onboarding_phase)
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
          <SelectTrigger className="h-7 w-[140px] text-[11px] bg-transparent border-border">
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

        <span className="text-[11px] italic text-muted-foreground ml-auto">
          {filteredRecruitRows.length} recruit
          {filteredRecruitRows.length === 1 ? "" : "s"}
          {leadRows.length > 0 && (
            <>
              {" · "}
              <span className="not-italic font-mono tabular-nums text-warning">
                {leadRows.length}
              </span>{" "}
              pending lead{leadRows.length === 1 ? "" : "s"}
            </>
          )}
        </span>
      </div>

      {/* Mobile card list */}
      <ul className="md:hidden flex flex-col">
        {paginatedRows.length === 0 && (
          <li className="border-t border-border py-10 text-center">
            <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-[12px] italic text-muted-foreground">
              {filteredRecruitRows.length === 0 &&
              leadRows.length === 0 &&
              recruitRows.length > 0
                ? "No recruits match your filters."
                : "No recruits yet."}
            </p>
          </li>
        )}
        {paginatedRows.map((row) => {
          if (row.kind === "lead") {
            const lead = row.lead;
            const isSelected = selectedLeadId === lead.id;
            return (
              <li key={`lead-${lead.id}`} className="border-t border-border">
                <button
                  type="button"
                  onClick={() => onSelectLead?.(lead)}
                  className={cn(
                    "w-full flex items-center gap-3 py-3 px-1 text-left hover:bg-muted/60 transition-colors",
                    isSelected && "bg-muted/60",
                  )}
                >
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarFallback className="text-[10px] bg-warning/10 text-warning ring-1 ring-warning/30">
                      {leadInitials(lead)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold tracking-tight text-foreground truncate">
                      {lead.first_name} {lead.last_name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={leadBadgeCls}>LEAD · PENDING</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {lead.email}
                      </span>
                    </div>
                  </div>
                  <Chev className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
                {onAcceptLead && onRejectLead && (
                  <div className="flex gap-1 px-1 pb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-success border-success/30 hover:bg-success/10"
                      disabled={isAcceptingLead}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptLead(lead);
                      }}
                    >
                      {isAcceptingLead ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <UserPlus className="h-3 w-3 mr-1" />
                      )}
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={isRejectingLead}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRejectLead(lead);
                      }}
                    >
                      {isRejectingLead ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            );
          }

          const recruit = row.recruit;
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
            <li key={recruit.id} className={cn("border-t border-border")}>
              <button
                type="button"
                onClick={() => onSelectRecruit(recruit)}
                className={cn(
                  "w-full flex items-center gap-3 py-3 px-1 text-left hover:bg-muted/60 /40 transition-colors",
                  selectedRecruitId === recruit.id && "bg-muted/60",
                )}
              >
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={recruit.profile_photo_url || undefined} />
                  <AvatarFallback className="text-[10px] bg-muted text-muted-foreground -subtle">
                    {recruitInitials(recruit)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold tracking-tight text-foreground truncate">
                    {recruit.first_name && recruit.last_name
                      ? `${recruit.first_name} ${recruit.last_name}`
                      : recruit.email?.split("@")[0] || "Unknown"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
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
                <Chev className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className={cn(headerCellCls, "w-12")}> </TableHead>
              <TableHead className={headerCellCls}>Name</TableHead>
              <TableHead className={headerCellCls}>Email</TableHead>
              <TableHead className={cn(headerCellCls, "w-[120px]")}>
                Phone
              </TableHead>
              <TableHead className={cn(headerCellCls, "w-[240px]")}>
                Status
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
            {paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <div className="flex flex-col items-center">
                    <Users className="h-7 w-7 text-muted-foreground mb-3" />
                    <p className="text-[12px] italic text-muted-foreground">
                      {filteredRecruitRows.length === 0 &&
                      leadRows.length === 0 &&
                      recruitRows.length > 0
                        ? "No recruits match your filters."
                        : "No recruits yet — send an invite or add one to start your pipeline."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => {
                if (row.kind === "lead") {
                  const lead = row.lead;
                  const isSelected = selectedLeadId === lead.id;
                  const days =
                    typeof lead.days_since_submitted === "number"
                      ? lead.days_since_submitted
                      : Math.floor(
                          (Date.now() - new Date(lead.submitted_at).getTime()) /
                            (1000 * 60 * 60 * 24),
                        );
                  return (
                    <TableRow
                      key={`lead-${lead.id}`}
                      onClick={() => onSelectLead?.(lead)}
                      className={cn(
                        "cursor-pointer border-b border-border/60 transition-colors",
                        isSelected ? "bg-muted/60" : "hover:bg-muted/50",
                      )}
                    >
                      <TableCell className="py-2 align-middle">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[9px] bg-warning/10 text-warning ring-1 ring-warning/30">
                            {leadInitials(lead)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="py-2 text-[13px] font-semibold tracking-tight text-foreground">
                        {lead.first_name} {lead.last_name}
                      </TableCell>
                      <TableCell className="py-2 text-[12px] text-muted-foreground truncate max-w-[200px]">
                        {lead.email || "—"}
                      </TableCell>
                      <TableCell className="py-2 text-[12px] font-mono tabular-nums text-muted-foreground">
                        {lead.phone || "—"}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-col gap-1.5">
                          <span className={leadBadgeCls}>LEAD · PENDING</span>
                          {onAcceptLead && onRejectLead && (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-success border-success/30 hover:bg-success/10"
                                disabled={isAcceptingLead}
                                onClick={() => onAcceptLead(lead)}
                              >
                                {isAcceptingLead ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <UserPlus className="h-3 w-3 mr-1" />
                                )}
                                Accept
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10"
                                disabled={isRejectingLead}
                                onClick={() => onRejectLead(lead)}
                              >
                                {isRejectingLead ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <XCircle className="h-3 w-3 mr-1" />
                                )}
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-[12px] text-muted-foreground">
                        {lead.recruiter_name?.split(" ")[0] || "—"}
                      </TableCell>
                      <TableCell className="py-2 text-[12px] font-mono tabular-nums text-center text-muted-foreground">
                        {days}
                      </TableCell>
                      <TableCell className="py-2 text-[11px] font-mono text-muted-foreground">
                        {formatDistanceToNow(new Date(lead.submitted_at), {
                          addSuffix: false,
                        })
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
                }

                const recruit = row.recruit;
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
                      "cursor-pointer border-b border-border/60 transition-colors",
                      selectedRecruitId === recruit.id
                        ? "bg-muted/60"
                        : "hover:bg-muted/50 ",
                    )}
                  >
                    <TableCell className="py-2 align-middle">
                      <Avatar className="h-7 w-7">
                        <AvatarImage
                          src={recruit.profile_photo_url || undefined}
                        />
                        <AvatarFallback className="text-[9px] bg-muted text-muted-foreground -subtle">
                          {recruitInitials(recruit)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="py-2 text-[13px] font-semibold tracking-tight text-foreground">
                      {recruit.first_name && recruit.last_name
                        ? `${recruit.first_name} ${recruit.last_name}`
                        : recruit.email?.split("@")[0] || "Unknown"}
                    </TableCell>
                    <TableCell className="py-2 text-[12px] text-muted-foreground -subtle truncate max-w-[200px]">
                      {recruit.email || "—"}
                    </TableCell>
                    <TableCell className="py-2 text-[12px] font-mono tabular-nums text-muted-foreground -subtle">
                      {recruit.phone || "—"}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {isTerminal ? (
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.16em] font-bold ring-1",
                            recruit.onboarding_status === "completed"
                              ? "bg-success/10 dark:bg-success/20 text-success ring-success/30 dark:ring-success"
                              : recruit.onboarding_status === "dropped"
                                ? "bg-destructive/10 dark:bg-destructive/20 text-destructive ring-destructive/30 dark:ring-destructive"
                                : "bg-muted dark:bg-muted text-foreground -subtle ring-border ",
                          )}
                        >
                          {recruit.onboarding_status?.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-foreground -subtle truncate">
                              {phaseName}
                            </div>
                            {summary && summary.totalItems > 0 && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 h-1 bg-muted dark:bg-muted rounded-full relative overflow-hidden">
                                  <div
                                    className="absolute inset-y-0 left-0 bg-warning rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono tabular-nums text-muted-foreground -subtle">
                                  {summary.completedItems}/{summary.totalItems}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-[12px] text-muted-foreground -subtle">
                      {recruitWithRelations.recruiter?.first_name
                        ? `${recruitWithRelations.recruiter.first_name[0]}. ${
                            recruitWithRelations.recruiter.last_name || ""
                          }`
                        : recruitWithRelations.recruiter?.email?.split(
                            "@",
                          )[0] || "—"}
                    </TableCell>
                    <TableCell className="py-2 text-[12px] font-mono tabular-nums text-center text-muted-foreground -subtle">
                      {daysInPipeline}
                    </TableCell>
                    <TableCell className="py-2 text-[11px] font-mono text-muted-foreground">
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border py-2 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Show
          </span>
          <Select
            value={pageSize.toString()}
            onValueChange={(val) => setPageSize(parseInt(val))}
          >
            <SelectTrigger className="h-6 w-[60px] text-[11px] bg-transparent border-border">
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

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center disabled:opacity-30 disabled:cursor-not-allowed hover:text-foreground transition-colors"
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
            className="inline-flex items-center disabled:opacity-30 disabled:cursor-not-allowed hover:text-foreground transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
          {paginatedRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
          {Math.min(currentPage * pageSize, visibleRows.length)} of{" "}
          {visibleRows.length}
        </span>
      </div>
    </div>
  );
}
