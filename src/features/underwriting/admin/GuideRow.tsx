import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  Loader2,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showToast } from "@/utils/toast";
import {
  guideQueryKeys,
  isGuideParsed,
  isParsingInProgress,
  hasParsingFailed,
  useDeleteGuide,
  useExtractRules,
  useParseGuide,
  useRuleSetsByGuide,
  useUpdateRuleSet,
  type RuleReviewStatus,
  type RuleSetWithRules,
} from "./useUnderwritingAdmin";
import { RuleCandidateCard } from "./RuleCandidateCard";
import { WorkflowProgress, type WorkflowState } from "./WorkflowProgress";
import type { UnderwritingGuide } from "../types/underwriting.types";

const STATUS_GROUPS: { label: string; status: RuleReviewStatus }[] = [
  { label: "Pending Review", status: "pending_review" },
  { label: "Approved", status: "approved" },
  { label: "Drafts", status: "draft" },
  { label: "Rejected", status: "rejected" },
];

interface GuideRowProps {
  guide: UnderwritingGuide;
  defaultOpen?: boolean;
}

export function GuideRow({ guide, defaultOpen = false }: GuideRowProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);

  const parsingStatus = guide.parsing_status ?? "pending";
  const parsingComplete = isGuideParsed(parsingStatus);
  const parsingInProgress = isParsingInProgress(parsingStatus);
  const parsingFailed = hasParsingFailed(parsingStatus);

  // Poll guide while parsing is mid-flight so the Extract CTA unlocks
  // automatically once the background parse finishes.
  useEffect(() => {
    if (!open) return;
    if (parsingComplete || parsingFailed) return;
    const id = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: guideQueryKeys.detail(guide.id),
      });
      queryClient.invalidateQueries({ queryKey: guideQueryKeys.all });
    }, 3000);
    return () => clearInterval(id);
  }, [open, parsingComplete, parsingFailed, queryClient, guide.id]);

  const { data: ruleSets = [], isLoading: rulesLoading } = useRuleSetsByGuide(
    open ? guide.id : undefined,
  );

  const grouped = useMemo(() => {
    const groups: Record<RuleReviewStatus, RuleSetWithRules[]> = {
      pending_review: [],
      approved: [],
      draft: [],
      rejected: [],
    };
    for (const set of ruleSets) {
      const status = (set.review_status ?? "draft") as RuleReviewStatus;
      groups[status]?.push(set);
    }
    return groups;
  }, [ruleSets]);

  const pendingCount = grouped.pending_review.length;
  const approvedCount = grouped.approved.length;

  const parseMutation = useParseGuide();
  const extractRules = useExtractRules();
  const updateRuleSet = useUpdateRuleSet();
  const deleteGuide = useDeleteGuide();

  const [extractProgress, setExtractProgress] = useState<{
    chunkIndex: number;
    totalChunks: number;
    setsCreated: number;
    rulesCreated: number;
  } | null>(null);

  const workflowState: WorkflowState = (() => {
    if (extractRules.isPending) return "extracting";
    if (parsingInProgress || parseMutation.isPending) return "parsing";
    if (parsingFailed) return "parse_failed";
    if (parsingComplete && pendingCount > 0) return "ready_for_review";
    if (parsingComplete) return "parsed";
    return "uploaded";
  })();

  const handleReparse = () => {
    parseMutation.mutate({
      guideId: guide.id,
      storagePath: guide.storage_path,
    });
  };

  const handleExtract = async () => {
    setExtractProgress(null);
    try {
      const result = await extractRules.mutateAsync({
        guideId: guide.id,
        onProgress: (p) => setExtractProgress(p),
      });
      const wallSec = (result.totalWallClockMs / 1000).toFixed(1);
      if (result.errors.length > 0) {
        showToast.warning(
          `${result.setsCreated} sets / ${result.rulesCreated} rules from ${result.totalChunks} chunks in ${wallSec}s — ${result.errors.length} warnings`,
        );
      } else {
        showToast.success(
          `${result.setsCreated} sets, ${result.rulesCreated} rules in ${wallSec}s`,
        );
      }
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtractProgress(null);
    }
  };

  const handleApprove = async (setId: string) => {
    try {
      await updateRuleSet.mutateAsync({
        id: setId,
        updates: { review_status: "approved" },
      });
      showToast.success("Rule set approved — now active in the engine");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Approve failed");
    }
  };

  const handleReject = async (setId: string) => {
    try {
      await updateRuleSet.mutateAsync({
        id: setId,
        updates: { review_status: "rejected" },
      });
      showToast.success("Rule set rejected");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Reject failed");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete guide "${guide.name}"? Extracted rule candidates remain in the database.`,
      )
    )
      return;
    try {
      await deleteGuide.mutateAsync(guide);
    } catch {
      // toast handled by mutation
    }
  };

  return (
    <div className="rounded border border-v2-ring bg-v2-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-v2-card-tinted transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-v2-ink-muted shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-v2-ink-muted shrink-0" />
        )}
        <FileText className="h-3.5 w-3.5 text-v2-ink-muted shrink-0" />
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-medium text-v2-ink truncate">
            {guide.name}
          </span>
          {guide.version ? (
            <span className="text-[10px] text-v2-ink-subtle">
              v{guide.version}
            </span>
          ) : null}
          <WorkflowProgress
            state={workflowState}
            chunkIndex={extractProgress?.chunkIndex}
            totalChunks={extractProgress?.totalChunks}
            setsCreated={extractProgress?.setsCreated}
            rulesCreated={extractProgress?.rulesCreated}
          />
          {pendingCount > 0 ? (
            <Badge
              variant="secondary"
              className="text-[9px] h-3.5 px-1 font-normal"
            >
              {pendingCount} pending
            </Badge>
          ) : null}
          {approvedCount > 0 ? (
            <Badge
              variant="default"
              className="text-[9px] h-3.5 px-1 font-normal"
            >
              {approvedCount} approved
            </Badge>
          ) : null}
        </div>
      </button>

      {open ? (
        <div className="border-t border-v2-ring">
          <div className="px-2.5 py-2 flex items-center gap-1.5 bg-v2-card-tinted/40 border-b border-v2-ring">
            <Button
              size="sm"
              variant="outline"
              onClick={handleReparse}
              disabled={parseMutation.isPending || parsingInProgress}
              className="h-6 text-[10px]"
              title="Re-run PDF parse"
            >
              <RefreshCw className="h-2.5 w-2.5 mr-1" />
              {parsingComplete ? "Re-parse" : "Parse"}
            </Button>
            <Button
              size="sm"
              onClick={handleExtract}
              disabled={extractRules.isPending || !parsingComplete}
              className="h-6 text-[10px]"
              title={
                !parsingComplete
                  ? "Wait for parsing to finish"
                  : "Extract rule candidates with Claude"
              }
            >
              {extractRules.isPending ? (
                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-2.5 w-2.5 mr-1" />
              )}
              {extractRules.isPending
                ? extractProgress
                  ? `Chunk ${extractProgress.chunkIndex + 1}/${extractProgress.totalChunks}`
                  : "Extracting…"
                : ruleSets.length === 0
                  ? "Extract rules"
                  : "Re-extract"}
            </Button>
            <div className="ml-auto">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleteGuide.isPending}
                className="h-6 text-[10px] text-destructive hover:text-destructive"
              >
                <Trash2 className="h-2.5 w-2.5 mr-1" />
                Delete
              </Button>
            </div>
          </div>

          <div className="px-2.5 py-2 space-y-3">
            {rulesLoading ? (
              <div className="flex items-center gap-1.5 text-[11px] text-v2-ink-muted">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading candidates…
              </div>
            ) : null}

            {!rulesLoading && ruleSets.length === 0 ? (
              <div className="rounded border border-v2-ring bg-v2-card-tinted/40 px-3 py-4 text-center">
                <Sparkles className="h-4 w-4 text-v2-ink-muted mx-auto mb-1.5" />
                <div className="text-[11px] font-medium text-v2-ink">
                  No candidates yet
                </div>
                <p className="text-[10px] text-v2-ink-muted mt-0.5">
                  {parsingComplete
                    ? "Click Extract rules to read this guide and generate v2 candidates."
                    : "Once parsing completes, click Extract rules."}
                </p>
              </div>
            ) : null}

            {STATUS_GROUPS.map((group) => {
              const sets = grouped[group.status];
              if (sets.length === 0) return null;
              return (
                <section key={group.status} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-v2-ink-muted">
                      {group.label}
                    </h3>
                    <span className="text-[10px] text-v2-ink-muted">
                      ({sets.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {sets.map((set) => (
                      <RuleCandidateCard
                        key={set.id}
                        ruleSet={set}
                        status={group.status}
                        onApprove={() => handleApprove(set.id)}
                        onReject={() => handleReject(set.id)}
                        isMutating={updateRuleSet.isPending}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
