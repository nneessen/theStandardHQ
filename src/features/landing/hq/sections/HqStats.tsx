/*
 * Stats band — 4 count-up figures. data-count/data-pre/data-suf are read by the
 * count-up effect in initLandingEffects. Reused for the hero band and the blue
 * "opportunity" band (via the `variant` prop, which sets the section id/heading).
 */

import { staggerStyle } from "../lib/cssVar";
import { HERO_STATS, OPP_STATS, type StatItem } from "../data/content";

function StatGrid({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid">
      {stats.map((s, i) => (
        <div className="stat" data-reveal style={staggerStyle(i)} key={s.label}>
          <div className="n">
            <span
              data-count={s.count}
              data-pre={s.prefix ?? ""}
              data-suf={s.suffix ?? ""}
            >
              0
            </span>
          </div>
          <div className="l">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function HqStats() {
  return (
    <section className="stats">
      <div className="wrap">
        <StatGrid stats={HERO_STATS} />
      </div>
    </section>
  );
}

export function HqOppStats() {
  return (
    <section className="stats" id="oppstats">
      <div className="wrap">
        <div className="stat-band-h" data-reveal>
          The Opportunity — <b>what your first year looks like</b>
        </div>
        <StatGrid stats={OPP_STATS} />
      </div>
    </section>
  );
}
