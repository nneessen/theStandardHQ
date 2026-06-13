import { Board, Cap, Num, RadialProgress, T } from "@/components/board";
import type { RadialTone } from "@/components/board";
import type { PersistencyCohort } from "@/hooks/policies";

/**
 * Persistency — the share of issued policies still in force at each anniversary.
 *
 * One ring per milestone (3 / 6 / 9 / 12 months). Each milestone is an
 * age-bounded "anniversary cohort": of policies that have reached ~N months of
 * tenure, what fraction is still active. The cohort sample size (`n`) is shown
 * under every ring so thin cohorts are honest rather than hidden.
 */

// Persistency is healthy in the high range; tint the ring by where it lands.
function toneFor(rate: number | null): RadialTone {
  if (rate == null) return "blue";
  if (rate >= 85) return "green";
  if (rate >= 70) return "amber";
  return "red";
}

function PersistencyRing({ cohort }: { cohort: PersistencyCohort }) {
  const { bucketMonths, cohortSize, activeCount, persistencyRate } = cohort;
  const hasData = persistencyRate != null && cohortSize > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
      }}
    >
      {hasData ? (
        <RadialProgress
          pct={persistencyRate / 100}
          size={118}
          thickness={11}
          tone={toneFor(persistencyRate)}
          caption={`${bucketMonths}-MO`}
        />
      ) : (
        // No cohort yet (no policies have reached this tenure) — recessed
        // placeholder so the row stays aligned without faking a 0% reading.
        <div
          style={{
            width: 118,
            height: 118,
            borderRadius: "50%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `2px dashed ${T.line2}`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <span style={{ font: `800 22px ${T.disp}`, color: T.mut2 }}>—</span>
          <span style={{ font: `700 10px ${T.mono}`, color: T.mut2 }}>
            {bucketMonths}-MO
          </span>
        </div>
      )}
      <div style={{ textAlign: "center" }}>
        <div style={{ font: `700 11px ${T.mono}`, color: T.mut }}>
          {hasData ? `${activeCount}/${cohortSize} active` : "no data yet"}
        </div>
        <div style={{ font: `700 10px ${T.mono}`, color: T.mut2 }}>
          n={cohortSize}
        </div>
      </div>
    </div>
  );
}

export function BoardPersistency({
  cohorts,
}: {
  cohorts: PersistencyCohort[];
}) {
  // Blended headline: active / issued across every cohort that has data.
  const totalActive = cohorts.reduce((s, c) => s + c.activeCount, 0);
  const totalCohort = cohorts.reduce((s, c) => s + c.cohortSize, 0);
  const blended =
    totalCohort > 0 ? Math.round((totalActive / totalCohort) * 100) : null;

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
        <Cap>Persistency · Policy Retention</Cap>
        <Num
          text={blended == null ? "—" : `${blended}%`}
          size="xs"
          color={blended == null ? T.mut : toneColor(blended)}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
          gap: 8,
          padding: "16px 20px",
        }}
      >
        {cohorts.map((c) => (
          <PersistencyRing key={c.bucketMonths} cohort={c} />
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
        Anniversary-cohort method: each milestone counts policies that have
        reached ~that age, then the share still active. Excludes pending
        applications. Small <span style={{ fontFamily: T.mono }}>n</span> means
        a thin cohort — read those rates with care.
      </div>
    </Board>
  );
}

// Inline helper kept local to the component (mirrors toneFor but returns the
// hex used by the SplitFlap header number).
function toneColor(rate: number): string {
  if (rate >= 85) return T.green;
  if (rate >= 70) return T.amber;
  return T.red;
}
