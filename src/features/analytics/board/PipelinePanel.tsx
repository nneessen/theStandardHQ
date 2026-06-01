// src/features/analytics/board/PipelinePanel.tsx
import { Clock, TrendingUp } from "lucide-react";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useAnalyticsData } from "@/hooks";
import { formatCurrency } from "@/lib/format";
import { parseLocalDate } from "@/lib/date";
import {
  Board,
  Cap,
  AnimatedNumber,
  Pill,
  EmptyState,
  T,
} from "@/components/board";

export function PipelinePanel() {
  const { dateRange } = useAnalyticsDateRange();

  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <Board
        pad={26}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            font: `500 12px ${T.mono}`,
            color: T.mut2,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Commission Pipeline
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `500 13px ${T.data}`,
            color: T.mut2,
          }}
        >
          Loading…
        </div>
      </Board>
    );
  }

  const now = new Date();
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const next60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const next90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Build policy map for O(1) lookups
  const policyMap = new Map(raw.policies.map((p) => [p.id, p]));

  let totalPending = 0;
  let bucket30 = 0;
  let bucket60 = 0;
  let bucket90 = 0;

  raw.commissions.forEach((commission) => {
    if (commission.status !== "pending") return;
    const amount = commission.amount ?? 0;
    totalPending += amount;

    const policy = policyMap.get(commission.policyId ?? "");
    if (policy?.effectiveDate) {
      const policyDate = parseLocalDate(policy.effectiveDate);
      const estimatedPayDate = new Date(
        policyDate.getTime() + 30 * 24 * 60 * 60 * 1000,
      );
      if (estimatedPayDate <= next30) {
        bucket30 += amount;
      } else if (estimatedPayDate <= next60) {
        bucket60 += amount;
      } else if (estimatedPayDate <= next90) {
        bucket90 += amount;
      }
    }
  });

  // Quarterly projection from historical paid commissions (last 90 days)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const paidLast90 = raw.commissions
    .filter((c) => {
      if (c.status !== "paid") return false;
      const payDate = c.paymentDate
        ? new Date(c.paymentDate as string)
        : new Date(c.createdAt);
      return payDate >= ninetyDaysAgo;
    })
    .reduce((sum, c) => sum + (c.amount ?? 0), 0);

  const projectedQuarterly = (paidLast90 / 90) * 90;

  const allBucketsEmpty = bucket30 === 0 && bucket60 === 0 && bucket90 === 0;
  const isEmpty = totalPending === 0 && allBucketsEmpty;

  const pipelinePct =
    projectedQuarterly > 0
      ? Math.round((totalPending / projectedQuarterly) * 100)
      : 0;

  const pillTone =
    totalPending > 50000 ? "green" : totalPending > 25000 ? "amber" : "red";

  const pillLabel =
    totalPending > 50000
      ? "Strong pipeline"
      : totalPending > 25000
        ? "Moderate pipeline"
        : "Weak pipeline";

  const buckets: { label: string; value: number }[] = [
    { label: "Next 30 days", value: bucket30 },
    { label: "Next 60 days", value: bucket60 },
    { label: "Next 90 days", value: bucket90 },
  ];

  return (
    <Board
      pad={26}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Cap>Commission Pipeline</Cap>
        <div
          style={{
            font: `600 18px ${T.data}`,
            color: T.ink,
            marginTop: 4,
          }}
        >
          Cash flow forecast
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<TrendingUp size={22} />}
          title="No pending commissions"
          hint="Pipeline appears once advances are booked."
          pad={40}
          style={{ flex: 1 }}
        />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Hero total pending */}
          <div style={{ marginBottom: 4 }}>
            <Cap style={{ marginBottom: 6 }}>Total Pending</Cap>
            <AnimatedNumber value={totalPending} prefix="$" size="lg" />
          </div>

          {/* Quarterly projection */}
          <div
            style={{
              font: `500 12px ${T.data}`,
              color: T.mut,
              marginBottom: 20,
            }}
          >
            Quarterly projection &middot;{" "}
            <span style={{ color: T.cream }}>
              {formatCurrency(projectedQuarterly)}
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: T.line2,
              marginBottom: 16,
            }}
          />

          {/* Bucket rows */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              flex: 1,
            }}
          >
            {buckets.map((b) => (
              <div
                key={b.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Clock size={13} style={{ color: T.green, flexShrink: 0 }} />
                  <span
                    style={{
                      font: `500 13px ${T.data}`,
                      color: T.mut,
                    }}
                  >
                    {b.label}
                  </span>
                </div>
                <span
                  style={{
                    font: `700 14px ${T.data}`,
                    color: T.green,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatCurrency(b.value)}
                </span>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Pill tone={pillTone} dot>
              {pillLabel}
            </Pill>
            {projectedQuarterly > 0 && (
              <span
                style={{
                  font: `500 12px ${T.data}`,
                  color: T.green,
                }}
              >
                {pipelinePct}% of quarterly target booked
              </span>
            )}
          </div>
        </div>
      )}
    </Board>
  );
}
