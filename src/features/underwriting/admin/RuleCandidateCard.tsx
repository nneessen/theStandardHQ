import { useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  RuleSetWithRules,
  RuleReviewStatus,
} from "./useUnderwritingAdmin";
import { RuleSetEditorDialog } from "./RuleSetEditorDialog";

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

interface RuleCandidateCardProps {
  ruleSet: RuleSetWithRules;
  status: RuleReviewStatus;
  carrierId: string;
  onApprove: () => void;
  onReject: () => void;
  isMutating: boolean;
}

export function RuleCandidateCard({
  ruleSet,
  status,
  carrierId,
  onApprove,
  onReject,
  isMutating,
}: RuleCandidateCardProps) {
  const [expanded, setExpanded] = useState(status === "pending_review");
  const [editorOpen, setEditorOpen] = useState(false);

  const ruleCount = ruleSet.rules?.length ?? 0;
  const sourcePages = useMemo(() => {
    const pages = new Set<number>();
    for (const rule of ruleSet.rules ?? []) {
      for (const p of rule.source_pages ?? []) pages.add(p);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }, [ruleSet.rules]);

  return (
    <div className="rounded border border-v2-ring bg-v2-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-v2-card-tinted transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 mt-0.5 text-v2-ink-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 mt-0.5 text-v2-ink-muted flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-medium text-v2-ink truncate">
              {ruleSet.name}
            </span>
            <Badge
              variant={STATUS_BADGE_VARIANT[status]}
              className="text-[9px] h-3.5 px-1 font-normal"
            >
              {status.replace("_", " ")}
            </Badge>
            <Badge
              variant="outline"
              className="text-[9px] h-3.5 px-1 font-normal"
            >
              {ruleSet.scope}
              {ruleSet.condition_code ? ` · ${ruleSet.condition_code}` : ""}
            </Badge>
            <span className="text-[10px] text-v2-ink-muted">
              {ruleCount} rule{ruleCount === 1 ? "" : "s"}
            </span>
            {sourcePages.length > 0 ? (
              <span className="text-[10px] text-v2-ink-subtle">
                p. {sourcePages.slice(0, 6).join(", ")}
                {sourcePages.length > 6 ? "…" : ""}
              </span>
            ) : null}
          </div>
          {ruleSet.description ? (
            <div className="text-[11px] text-v2-ink-muted mt-0.5 truncate">
              {ruleSet.description}
            </div>
          ) : null}
        </div>
      </button>

      {expanded ? (
        <>
          <div className="border-t border-v2-ring px-2.5 py-2 space-y-1.5">
            {(ruleSet.rules ?? []).map((rule) => {
              const eligibilityLabel =
                ELIGIBILITY_BADGE_TEXT[rule.outcome_eligibility] ??
                rule.outcome_eligibility;
              return (
                <div
                  key={rule.id}
                  className="flex items-start gap-2 py-1 border-b border-v2-ring/40 last:border-b-0"
                >
                  <span className="text-[10px] text-v2-ink-subtle mt-0.5 w-6 flex-shrink-0">
                    #{rule.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-medium text-v2-ink">
                        {rule.name}
                      </span>
                      <Badge
                        variant={
                          rule.outcome_eligibility === "ineligible"
                            ? "destructive"
                            : rule.outcome_eligibility === "refer"
                              ? "secondary"
                              : "default"
                        }
                        className="text-[9px] h-3.5 px-1 font-normal"
                      >
                        {eligibilityLabel}
                      </Badge>
                      {rule.outcome_health_class &&
                      rule.outcome_health_class !== "unknown" ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-3.5 px-1 font-normal"
                        >
                          {rule.outcome_health_class}
                        </Badge>
                      ) : null}
                      {rule.outcome_table_rating &&
                      rule.outcome_table_rating !== "none" ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-3.5 px-1 font-normal"
                        >
                          Table {rule.outcome_table_rating}
                        </Badge>
                      ) : null}
                    </div>
                    {rule.outcome_reason ? (
                      <div className="text-[10px] text-v2-ink-muted mt-0.5 leading-snug">
                        {rule.outcome_reason}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {ruleCount === 0 ? (
              <div className="text-[10px] text-v2-ink-muted italic">
                No rules in this set yet.
              </div>
            ) : null}
          </div>

          <div className="border-t border-v2-ring px-2.5 py-1.5 bg-v2-card-tinted flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditorOpen(true)}
              disabled={isMutating}
              className="h-6 text-[10px]"
            >
              <Pencil className="h-2.5 w-2.5 mr-1" /> Edit
            </Button>
            {status === "pending_review" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReject}
                  disabled={isMutating}
                  className="h-6 text-[10px]"
                >
                  {isMutating ? (
                    <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                  ) : (
                    <XCircle className="h-2.5 w-2.5 mr-1" />
                  )}
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={isMutating}
                  className="h-6 text-[10px]"
                >
                  {isMutating ? (
                    <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                  )}
                  Approve
                </Button>
              </>
            ) : null}
          </div>
        </>
      ) : null}
      <RuleSetEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        carrierId={carrierId}
        ruleSet={ruleSet}
      />
    </div>
  );
}
