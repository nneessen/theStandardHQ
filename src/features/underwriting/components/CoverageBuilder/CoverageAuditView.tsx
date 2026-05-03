import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCoverageAudit } from "../../hooks/coverage/useCoverageAudit";
// eslint-disable-next-line no-restricted-imports
import type {
  CoverageAuditConditionRow,
  CoverageAuditProductRow,
  CoverageAuditProductStatus,
} from "@/services/underwriting/core/coverageAudit";

interface CoverageAuditViewProps {
  onOpenBuilder?: (args: {
    carrierId: string;
    carrierName: string;
    productId: string;
    productName: string;
  }) => void;
}

type StatusFilter = "all" | CoverageAuditProductStatus;

const STATUS_FILTERS: StatusFilter[] = ["all", "unsafe", "review", "ready"];

export function CoverageAuditView({ onOpenBuilder }: CoverageAuditViewProps) {
  const { data: report, isLoading, error } = useCoverageAudit();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null,
  );

  const deferredSearchQuery = useDeferredValue(
    searchQuery.trim().toLowerCase(),
  );

  const filteredProducts = useMemo(() => {
    if (!report) {
      return [];
    }

    return report.products.filter((product) => {
      if (statusFilter !== "all" && product.productStatus !== statusFilter) {
        return false;
      }

      if (!deferredSearchQuery) {
        return true;
      }

      const issueSearchBlob = product.conditions
        .filter((condition) => condition.status !== "rule_based")
        .map((condition) =>
          [
            condition.conditionCode,
            condition.conditionName,
            condition.legacyAcceptanceDecision ?? "",
            condition.legacyAcceptanceNotes ?? "",
          ].join(" "),
        )
        .join(" ");

      return [
        product.carrierName,
        product.productName,
        product.productType,
        issueSearchBlob,
      ]
        .join(" ")
        .toLowerCase()
        .includes(deferredSearchQuery);
    });
  }, [deferredSearchQuery, report, statusFilter]);

  if (isLoading) {
    return (
      <div className="text-[11px] text-muted-foreground py-6 text-center">
        Loading coverage audit...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
        Failed to load coverage audit.{" "}
        {error instanceof Error ? error.message : ""}
      </div>
    );
  }

  if (!report || report.products.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground py-6 text-center">
        No carrier products found for coverage audit.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-v2-ring bg-v2-canvas/70 p-3 dark:border-v2-ring dark:bg-v2-card/60">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h3 className="text-[12px] font-semibold text-foreground">
              Coverage Audit
            </h3>
            <p className="max-w-3xl text-[10px] leading-4 text-muted-foreground">
              `Ready` means every active wizard condition has an approved v2
              rule set. `Review` means the product is modeled but at least one
              condition is manual-review only. `Unsafe` means the product is
              still missing v2 rule coverage or only has legacy acceptance data.
            </p>
          </div>
          <div className="text-[9px] text-muted-foreground">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <SummaryTile
            label="Unsafe Products"
            value={report.summary.unsafeProducts}
            detail={`${report.summary.missingConditions} missing condition gaps`}
            tone="unsafe"
          />
          <SummaryTile
            label="Review Products"
            value={report.summary.reviewProducts}
            detail={`${report.summary.manualReviewOnlyConditions} manual-review conditions`}
            tone="review"
          />
          <SummaryTile
            label="Ready Products"
            value={report.summary.readyProducts}
            detail={`${report.summary.totalProducts} total products audited`}
            tone="ready"
          />
          <SummaryTile
            label="Legacy-Only Conditions"
            value={report.summary.legacyAcceptanceOnlyConditions}
            detail={`${report.summary.medicationAwareConditions} medication-aware rule sets`}
            tone="neutral"
          />
        </div>
      </div>

      <div className="rounded-md border border-v2-ring bg-white p-3 dark:border-v2-ring dark:bg-v2-canvas">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold text-foreground">
            Carrier Snapshot
          </h4>
          <span className="text-[9px] text-muted-foreground">
            Worst products first
          </span>
        </div>
        <div className="space-y-1">
          {report.carriers.map((carrier) => (
            <div
              key={carrier.carrierId}
              className="flex items-center gap-2 rounded border border-v2-ring/80 px-2 py-1.5 text-[10px] dark:border-v2-ring"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {carrier.carrierName}
              </span>
              <Badge variant="destructive" size="sm">
                {carrier.unsafeProducts} unsafe
              </Badge>
              <Badge variant="warning" size="sm">
                {carrier.reviewProducts} review
              </Badge>
              <Badge variant="success" size="sm">
                {carrier.readyProducts} ready
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-v2-ring bg-white p-3 dark:border-v2-ring dark:bg-v2-canvas">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-80">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7 text-[11px]"
              placeholder="Search carrier, product, or condition gap..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  "rounded-full border px-2 py-1 text-[10px] font-medium transition-colors",
                  statusFilter === filter
                    ? "border-v2-ink bg-v2-ink text-v2-canvas dark:border-v2-ring dark:bg-v2-card-tinted dark:text-v2-ink"
                    : "border-v2-ring bg-white text-v2-ink-muted hover:border-v2-ring-strong hover:text-v2-ink dark:border-v2-ring dark:bg-v2-canvas dark:text-v2-ink-muted dark:hover:border-v2-ring-strong dark:hover:text-v2-canvas",
                )}
              >
                {getStatusFilterLabel(filter)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {!filteredProducts.length ? (
            <div className="py-6 text-center text-[11px] text-muted-foreground">
              No products match the current audit filters.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const productKey = `${product.carrierId}:${product.productId}`;
              const isExpanded = expandedProductId === productKey;

              return (
                <div
                  key={productKey}
                  className="overflow-hidden rounded-md border border-v2-ring dark:border-v2-ring"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedProductId(isExpanded ? null : productKey)
                    }
                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-v2-canvas dark:hover:bg-v2-card-tinted"
                  >
                    <div className="flex items-center pt-0.5">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate text-[11px] font-semibold text-foreground">
                          {product.carrierName} / {product.productName}
                        </span>
                        <Badge
                          variant={getProductBadgeVariant(
                            product.productStatus,
                          )}
                          size="sm"
                        >
                          {getProductStatusLabel(product.productStatus)}
                        </Badge>
                        <Badge variant="outline" size="sm">
                          {formatProductType(product.productType)}
                        </Badge>
                      </div>
                      <div className="grid gap-1 text-[10px] text-muted-foreground md:grid-cols-5">
                        <MetricChip
                          label="Rule-Based"
                          value={`${product.ruleBasedCount}/${product.totalConditions}`}
                        />
                        <MetricChip
                          label="Manual Review"
                          value={String(product.manualReviewOnlyCount)}
                        />
                        <MetricChip
                          label="Legacy Only"
                          value={String(product.legacyAcceptanceOnlyCount)}
                        />
                        <MetricChip
                          label="Missing"
                          value={String(product.missingCount)}
                        />
                        <MetricChip
                          label="Medication-Aware"
                          value={String(product.medicationAwareCount)}
                        />
                      </div>
                    </div>
                    <div className="hidden text-right md:block">
                      <div className="text-[10px] font-medium text-foreground">
                        {product.definitiveCoveragePercent}% definitive
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        based on active wizard conditions
                      </div>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-v2-ring bg-v2-canvas/60 px-3 py-3 dark:border-v2-ring dark:bg-v2-canvas/50">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p className="text-[10px] leading-4 text-muted-foreground">
                          {getProductStatusDescription(product)}
                        </p>
                        {onOpenBuilder ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenBuilder({
                                carrierId: product.carrierId,
                                carrierName: product.carrierName,
                                productId: product.productId,
                                productName: product.productName,
                              });
                            }}
                          >
                            Open In Builder
                          </Button>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <ConditionSection
                          title="Missing v2 rule sets"
                          emptyLabel="No missing base-condition gaps."
                          tone="destructive"
                          conditions={product.conditions.filter(
                            (condition) => condition.status === "missing",
                          )}
                        />
                        <ConditionSection
                          title="Legacy acceptance only"
                          emptyLabel="No legacy-only coverage."
                          tone="warning"
                          conditions={product.conditions.filter(
                            (condition) =>
                              condition.status === "legacy_acceptance_only",
                          )}
                        />
                        <ConditionSection
                          title="Manual review only"
                          emptyLabel="No manual-review-only rule sets."
                          tone="warning"
                          conditions={product.conditions.filter(
                            (condition) =>
                              condition.status === "manual_review_only",
                          )}
                        />
                        <ConditionSection
                          title="Medication-aware rule sets"
                          emptyLabel="No medication-aware predicates detected."
                          tone="info"
                          conditions={product.conditions.filter(
                            (condition) => condition.hasMedicationRule,
                          )}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTile(props: {
  detail: string;
  label: string;
  tone: "ready" | "review" | "unsafe" | "neutral";
  value: number;
}) {
  const { detail, label, tone, value } = props;

  return (
    <div className="rounded-md border border-v2-ring bg-white px-3 py-2 dark:border-v2-ring dark:bg-v2-canvas">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">
          {label}
        </span>
        <StatusIcon tone={tone} />
      </div>
      <div className="mt-1 text-[18px] font-semibold leading-none text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[9px] leading-4 text-muted-foreground">
        {detail}
      </div>
    </div>
  );
}

function StatusIcon({
  tone,
}: {
  tone: "ready" | "review" | "unsafe" | "neutral";
}) {
  if (tone === "ready") {
    return <ShieldCheck className="h-4 w-4 text-success" />;
  }

  if (tone === "review") {
    return <ShieldAlert className="h-4 w-4 text-warning" />;
  }

  if (tone === "unsafe") {
    return <ShieldX className="h-4 w-4 text-destructive" />;
  }

  return <AlertTriangle className="h-4 w-4 text-v2-ink-muted" />;
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-v2-ring bg-white px-2 py-1 dark:border-v2-ring dark:bg-v2-canvas">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-[10px] font-medium text-foreground">{value}</div>
    </div>
  );
}

function ConditionSection(props: {
  conditions: CoverageAuditConditionRow[];
  emptyLabel: string;
  title: string;
  tone: "destructive" | "warning" | "info";
}) {
  const { conditions, emptyLabel, title, tone } = props;

  return (
    <div className="rounded-md border border-v2-ring bg-white p-3 dark:border-v2-ring dark:bg-v2-canvas">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h5>
        <Badge variant={getToneVariant(tone)} size="sm">
          {conditions.length}
        </Badge>
      </div>

      {!conditions.length ? (
        <div className="text-[10px] text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto pr-1">
          {conditions.map((condition) => (
            <Badge
              key={`${condition.productId}:${condition.conditionCode}:${title}`}
              variant={getToneVariant(tone)}
              size="sm"
              className="max-w-full"
              title={buildConditionTitle(condition)}
            >
              <span className="truncate">
                {formatConditionLabel(condition)}
              </span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function formatConditionLabel(condition: CoverageAuditConditionRow): string {
  if (condition.status === "legacy_acceptance_only") {
    return `${condition.conditionName} (${condition.legacyAcceptanceDecision ?? "legacy"})`;
  }

  if (
    condition.status === "manual_review_only" &&
    condition.hasMedicationRule
  ) {
    return `${condition.conditionName} (medication-aware)`;
  }

  return condition.conditionName;
}

function buildConditionTitle(condition: CoverageAuditConditionRow): string {
  if (condition.status === "legacy_acceptance_only") {
    return [
      condition.conditionName,
      `Legacy acceptance: ${condition.legacyAcceptanceDecision ?? "unknown"}`,
      condition.legacyAcceptanceNotes ?? "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (condition.status === "manual_review_only") {
    return [
      condition.conditionName,
      condition.ruleSetName ? `Rule set: ${condition.ruleSetName}` : "",
      condition.hasMedicationRule ? "Medication-aware predicate detected" : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return condition.conditionName;
}

function getToneVariant(tone: "destructive" | "warning" | "info") {
  if (tone === "destructive") {
    return "destructive" as const;
  }

  if (tone === "info") {
    return "info" as const;
  }

  return "warning" as const;
}

function getStatusFilterLabel(filter: StatusFilter) {
  if (filter === "all") {
    return "All";
  }

  return getProductStatusLabel(filter);
}

function getProductBadgeVariant(status: CoverageAuditProductStatus) {
  if (status === "ready") {
    return "success" as const;
  }

  if (status === "review") {
    return "warning" as const;
  }

  return "destructive" as const;
}

function getProductStatusLabel(status: CoverageAuditProductStatus) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "review") {
    return "Review";
  }

  return "Unsafe";
}

function getProductStatusDescription(product: CoverageAuditProductRow) {
  if (product.productStatus === "ready") {
    return "Every active wizard condition has approved v2 rule coverage for this product.";
  }

  if (product.productStatus === "review") {
    return "This product is modeled, but one or more active conditions still resolve to manual review only.";
  }

  return "This product still has uncovered base conditions or depends on legacy acceptance data that does not protect live recommendations.";
}

function formatProductType(productType: string) {
  return productType
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
