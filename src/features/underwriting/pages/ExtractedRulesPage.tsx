import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showToast } from "@/utils/toast";
import {
  useUnderwritingGuide,
  guideQueryKeys,
} from "../hooks/guides/useUnderwritingGuides";
import { useUpdateRuleSet } from "../hooks/rules/useRuleSets";
import {
  useRuleSetsByGuide,
  useExtractRules,
} from "../hooks/rules/useRuleSetsByGuide";
// eslint-disable-next-line no-restricted-imports
import type {
  RuleSetWithRules,
  RuleReviewStatus,
} from "@/services/underwriting/repositories/ruleService";

interface ExtractedRulesPageProps {
  guideId: string;
}

const STATUS_GROUPS: { label: string; status: RuleReviewStatus }[] = [
  { label: "Pending Review", status: "pending_review" },
  { label: "Approved", status: "approved" },
  { label: "Drafts", status: "draft" },
  { label: "Rejected", status: "rejected" },
];

const STATUS_BADGE_VARIANT: Record<
  RuleReviewStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending_review: "secondary",
  approved: "default",
  draft: "outline",
  rejected: "destructive",
};

const ELIGIBILITY_BADGE_TEXT: Record<string, string> = {
  eligible: "Eligible",
  ineligible: "Ineligible",
  refer: "Refer",
};

export default function ExtractedRulesPage({
  guideId,
}: ExtractedRulesPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: guide, isLoading: guideLoading } =
    useUnderwritingGuide(guideId);
  const { data: ruleSets = [], isLoading: rulesLoading } =
    useRuleSetsByGuide(guideId);
  const updateRuleSet = useUpdateRuleSet();
  const extractRules = useExtractRules();

  const parsingStatus = guide?.parsing_status ?? "pending";
  const parsingComplete = parsingStatus === "completed";
  const parsingFailed = parsingStatus === "failed";

  // Poll guide every 3s while parsing is in flight so the Extract button
  // unlocks automatically once parse-underwriting-guide finishes in the
  // background. Stop polling once parsingStatus reaches a terminal state.
  useEffect(() => {
    if (parsingComplete || parsingFailed) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: guideQueryKeys.detail(guideId),
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [parsingComplete, parsingFailed, queryClient, guideId]);

  // useUnderwritingGuide already joins carriers(id, name) into guide.carrier,
  // so no separate carrier query is needed.
  const carrierName = guide?.carrier?.name ?? "Unknown carrier";

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

  const handleExtract = async () => {
    try {
      const result = await extractRules.mutateAsync({ guideId });
      if (result.errors.length > 0) {
        showToast.warning(
          `Extracted ${result.setsCreated} sets / ${result.rulesCreated} rules with ${result.errors.length} errors`,
        );
      } else {
        showToast.success(
          `Extracted ${result.setsCreated} sets, ${result.rulesCreated} rules in ${(result.totalDurationMs / 1000).toFixed(1)}s`,
        );
      }
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Extraction failed");
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

  if (guideLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-muted" />
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="p-6">
        <div className="text-sm text-v2-ink">Guide not found</div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => navigate({ to: "/underwriting/guides" })}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Guides
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-v2-ring bg-v2-card flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/underwriting/guides" })}
          className="h-7 w-7 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FileText className="h-4 w-4 text-v2-ink-muted" />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-v2-ink truncate">
            {guide.name}
          </span>
          <span className="text-[11px] text-v2-ink-muted truncate">
            {carrierName}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant={
              parsingComplete
                ? "default"
                : parsingFailed
                  ? "destructive"
                  : "secondary"
            }
            className="text-[10px] h-4 px-1.5 font-normal"
          >
            {parsingComplete
              ? "Parsed"
              : parsingFailed
                ? `Parse failed`
                : `Parsing... (${parsingStatus})`}
          </Badge>
          <Button
            size="sm"
            onClick={handleExtract}
            disabled={extractRules.isPending || !parsingComplete}
            className="h-7 text-xs"
            title={
              !parsingComplete
                ? "Wait for parsing to finish before extracting rules"
                : undefined
            }
          >
            {extractRules.isPending ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1.5" />
            )}
            {extractRules.isPending
              ? "Extracting..."
              : ruleSets.length === 0
                ? "Extract Rules"
                : "Re-extract"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {rulesLoading && (
          <div className="flex items-center gap-2 text-xs text-v2-ink-muted">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading candidates...
          </div>
        )}

        {!rulesLoading && ruleSets.length === 0 && (
          <div className="rounded-v2-md border border-v2-ring bg-v2-card-tinted p-6 text-center">
            <Sparkles className="h-6 w-6 text-v2-ink-muted mx-auto mb-2" />
            <div className="text-sm font-medium text-v2-ink">
              No candidates yet
            </div>
            <p className="text-xs text-v2-ink-muted mt-1 max-w-md mx-auto">
              Click <span className="font-semibold">Extract Rules</span> to ask
              Claude to read this guide and generate v2-shaped rule candidates.
              Candidates land here as <em>pending review</em> — you approve them
              one-by-one before they go live in the engine.
            </p>
          </div>
        )}

        {STATUS_GROUPS.map((group) => {
          const sets = grouped[group.status];
          if (sets.length === 0) return null;
          return (
            <section key={group.status} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-v2-ink-muted">
                  {group.label}
                </h2>
                <Badge
                  variant={STATUS_BADGE_VARIANT[group.status]}
                  className="text-[10px] h-4 px-1.5 font-normal"
                >
                  {sets.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {sets.map((set) => (
                  <RuleSetReviewCard
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
  );
}

interface RuleSetReviewCardProps {
  ruleSet: RuleSetWithRules;
  status: RuleReviewStatus;
  onApprove: () => void;
  onReject: () => void;
  isMutating: boolean;
}

function RuleSetReviewCard({
  ruleSet,
  status,
  onApprove,
  onReject,
  isMutating,
}: RuleSetReviewCardProps) {
  const [expanded, setExpanded] = useState(status === "pending_review");

  const ruleCount = ruleSet.rules?.length ?? 0;
  const sourcePages = useMemo(() => {
    const pages = new Set<number>();
    for (const rule of ruleSet.rules ?? []) {
      for (const p of rule.source_pages ?? []) pages.add(p);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }, [ruleSet.rules]);

  return (
    <div className="rounded-v2-md border border-v2-ring bg-v2-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-v2-card-tinted transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 mt-0.5 text-v2-ink-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-v2-ink-muted flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-v2-ink truncate">
              {ruleSet.name}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 font-normal"
            >
              {ruleSet.scope}
              {ruleSet.condition_code ? ` · ${ruleSet.condition_code}` : ""}
            </Badge>
            <span className="text-[11px] text-v2-ink-muted">
              {ruleCount} rule{ruleCount === 1 ? "" : "s"}
            </span>
            {sourcePages.length > 0 && (
              <span className="text-[11px] text-v2-ink-subtle">
                p. {sourcePages.join(", ")}
              </span>
            )}
          </div>
          {ruleSet.description && (
            <div className="text-xs text-v2-ink-muted mt-0.5 truncate">
              {ruleSet.description}
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <>
          <div className="border-t border-v2-ring px-3 py-2.5 space-y-2">
            {(ruleSet.rules ?? []).map((rule) => (
              <RuleRow key={rule.id} rule={rule} />
            ))}
            {ruleCount === 0 && (
              <div className="text-xs text-v2-ink-muted italic">
                No rules in this set yet.
              </div>
            )}
          </div>

          {status === "pending_review" && (
            <div className="border-t border-v2-ring px-3 py-2 bg-v2-card-tinted flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onReject}
                disabled={isMutating}
                className="h-7 text-xs"
              >
                <XCircle className="h-3 w-3 mr-1.5" /> Reject
              </Button>
              <Button
                size="sm"
                onClick={onApprove}
                disabled={isMutating}
                className="h-7 text-xs"
              >
                <CheckCircle2 className="h-3 w-3 mr-1.5" /> Approve
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface RuleRowProps {
  rule: RuleSetWithRules["rules"][number];
}

function RuleRow({ rule }: RuleRowProps) {
  const eligibilityLabel =
    ELIGIBILITY_BADGE_TEXT[rule.outcome_eligibility] ??
    rule.outcome_eligibility;

  return (
    <div className="flex items-start gap-2.5 py-1.5 border-b border-v2-ring last:border-b-0">
      <span className="text-[10px] text-v2-ink-subtle mt-0.5 w-8 flex-shrink-0">
        #{rule.priority}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-v2-ink">{rule.name}</span>
          <Badge
            variant={
              rule.outcome_eligibility === "ineligible"
                ? "destructive"
                : rule.outcome_eligibility === "refer"
                  ? "secondary"
                  : "default"
            }
            className="text-[10px] h-4 px-1.5 font-normal"
          >
            {eligibilityLabel}
          </Badge>
          {rule.outcome_health_class &&
            rule.outcome_health_class !== "unknown" && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-normal"
              >
                {rule.outcome_health_class}
              </Badge>
            )}
          {rule.outcome_table_rating &&
            rule.outcome_table_rating !== "none" && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-normal"
              >
                Table {rule.outcome_table_rating}
              </Badge>
            )}
          {typeof rule.extraction_confidence === "number" && (
            <span className="text-[10px] text-v2-ink-subtle">
              conf {(rule.extraction_confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {rule.outcome_reason && (
          <div className="text-[11px] text-v2-ink-muted mt-0.5 leading-snug">
            {rule.outcome_reason}
          </div>
        )}
        {rule.source_snippet && (
          <div className="text-[10px] text-v2-ink-subtle mt-1 italic line-clamp-2">
            "{rule.source_snippet}"
          </div>
        )}
      </div>
    </div>
  );
}
