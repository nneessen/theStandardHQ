import { Board, Bar, Cap, Num, T } from "@/components/board";
import type { BarTone } from "@/components/board";
import type { PersistencyCohort } from "@/hooks/policies";

/**
 * Persistency — what share of the policies that have reached each age are still
 * active. One compact column per milestone (3 / 6 / 9 / 12 months): a big
 * percentage, a thin progress bar, and the raw "X of Y" count so a small sample
 * is obvious. No rings — kept tight so it doesn't eat vertical space.
 */

// Persistency is healthy in the high range; tint by where it lands.
function toneFor(rate: number | null): BarTone {
  if (rate == null) return "blue";
  if (rate >= 85) return "green";
  if (rate >= 70) return "amber";
  return "red";
}

const TONE_HEX: Record<BarTone, string> = {
  blue: T.blue,
  amber: T.amber,
  green: T.green,
  red: T.red,
};

function PersistencyCell({ cohort }: { cohort: PersistencyCohort }) {
  const { bucketMonths, cohortSize, activeCount, persistencyRate } = cohort;
  const hasData = persistencyRate != null && cohortSize > 0;
  const tone = toneFor(persistencyRate);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px 16px",
        borderRadius: 10,
        background: T.tile,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <Cap style={{ fontSize: 11 }}>{bucketMonths}-Month</Cap>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            font: `800 30px ${T.disp}`,
            lineHeight: 1,
            color: hasData ? TONE_HEX[tone] : T.mut2,
          }}
        >
          {hasData ? `${Math.round(persistencyRate)}%` : "—"}
        </span>
      </div>

      <Bar pct={hasData ? persistencyRate / 100 : 0} tone={tone} height={7} />

      <div style={{ font: `600 12px ${T.data}`, color: T.mut }}>
        {hasData
          ? `${activeCount} of ${cohortSize} still active`
          : "No policies this old yet"}
      </div>
    </div>
  );
}

export function BoardPersistency({
  cohorts,
}: {
  cohorts: PersistencyCohort[];
}) {
  // Blended headline: active / total across every milestone that has policies.
  const totalActive = cohorts.reduce((s, c) => s + c.activeCount, 0);
  const totalCount = cohorts.reduce((s, c) => s + c.cohortSize, 0);
  const blended =
    totalCount > 0 ? Math.round((totalActive / totalCount) * 100) : null;
  const blendedTone = blended == null ? "blue" : toneFor(blended);

  return (
    <Board pad={0} rivets={false} style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${T.line}`,
        }}
      >
        <Cap>Persistency · Policies Still Active</Cap>
        <Num
          text={blended == null ? "—" : `${blended}%`}
          size="xs"
          color={blended == null ? T.mut : TONE_HEX[blendedTone]}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
          gap: 10,
          padding: "16px 20px",
        }}
      >
        {cohorts.map((c) => (
          <PersistencyCell key={c.bucketMonths} cohort={c} />
        ))}
      </div>

      <div
        style={{
          padding: "0 20px 14px",
          fontSize: 11.5,
          lineHeight: 1.5,
          color: T.mut2,
        }}
      >
        Of the policies that have reached each age, the share still in force.
        Pending applications aren't counted. A low count means few policies have
        reached that age yet — read those numbers with care.
      </div>
    </Board>
  );
}
