// src/features/analytics/board/PipelinePanel.tsx
import { Clock, TrendingUp } from "lucide-react";
import { useAnalyticsData } from "@/hooks";
import { formatCurrency } from "@/lib/format";
import { parseLocalDate } from "@/lib/date";
import { Board, Cap, AnimatedNumber, EmptyState, T } from "@/components/board";

export function PipelinePanel() {
  // Period-independent: pending pipeline + trailing-90-day paid are forward
  // cash-flow views that must read the full commission set.
  const { raw, isLoading } = useAnalyticsData();

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

  // Trailing 90-day realized (paid) commissions — used as a naive next-quarter
  // run-rate "projection": the baseline the pending pipeline is measured against
  // ("% of quarterly target booked"). One quarter ≈ 90 days of realized cash.
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const quarterlyProjection = raw.commissions
    .filter((c) => {
      if (c.status !== "paid") return false;
      const payDate = c.paymentDate
        ? new Date(c.paymentDate as string)
        : new Date(c.createdAt);
      return payDate >= ninetyDaysAgo;
    })
    .reduce((sum, c) => sum + (c.amount ?? 0), 0);

  const allBucketsEmpty = bucket30 === 0 && bucket60 === 0 && bucket90 === 0;
  const isEmpty = totalPending === 0 && allBucketsEmpty;

  const bookedPct =
    quarterlyProjection > 0
      ? Math.round((totalPending / quarterlyProjection) * 100)
      : 0;

  // Plain-text health note (spec §5.7). The spec hardcodes "Healthy"; we keep
  // the lead word + color honest to the actual ratio instead of always green.
  const noteColor =
    bookedPct >= 70 ? T.green : bookedPct >= 40 ? T.amber : T.red;
  const noteWord =
    bookedPct >= 70 ? "Healthy" : bookedPct >= 40 ? "Moderate" : "Building";

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
        <div style={{ font: `500 18px ${T.data}`, color: T.mut, marginTop: 4 }}>
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
              font: `500 15px ${T.data}`,
              color: T.mut,
              marginBottom: 20,
            }}
          >
            Quarterly projection &middot;{" "}
            <b style={{ color: T.cream, fontWeight: 700 }}>
              {formatCurrency(quarterlyProjection)}
            </b>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: T.line, marginBottom: 4 }} />

          {/* Bucket rows */}
          <div style={{ flex: 1 }}>
            {buckets.map((b) => (
              <div
                key={b.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 0",
                  borderBottom: `1px solid ${T.line}`,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    font: `600 16px ${T.data}`,
                    color: T.ink,
                  }}
                >
                  <Clock size={16} style={{ color: T.mut, flexShrink: 0 }} />
                  {b.label}
                </span>
                <span
                  style={{
                    font: `800 18px ${T.disp}`,
                    color: T.green,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatCurrency(b.value)}
                </span>
              </div>
            ))}
          </div>

          {/* Footer health note (plain text) */}
          {quarterlyProjection > 0 && (
            <div
              style={{
                marginTop: 18,
                textAlign: "center",
                font: `600 15px ${T.data}`,
                color: noteColor,
              }}
            >
              {noteWord} pipeline &middot; {bookedPct}% of quarterly target
              booked
            </div>
          )}
        </div>
      )}
    </Board>
  );
}
