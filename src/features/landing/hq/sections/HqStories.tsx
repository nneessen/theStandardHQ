/*
 * Stories — vertical testimonial marquee (3 columns, duplicated for a seamless
 * CSS loop). id="stories".
 *
 * Renders ONLY when TESTIMONIALS is non-empty (the page guards it). The
 * reference shipped placeholder quotes; per the no-mock-data rule this stays
 * out until real, attributable quotes are added to data/testimonials.ts.
 */

import { staggerStyle } from "../lib/cssVar";
import { TESTIMONIALS, type Testimonial } from "../data/testimonials";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
}

function Card({ t }: { t: Testimonial }) {
  return (
    <div className="tcard">
      <p>&ldquo;{t.quote}&rdquo;</p>
      <div className="who">
        <div className="av">{initials(t.name)}</div>
        <div>
          <div className="nm">{t.name}</div>
          <div className="rl">{t.role}</div>
        </div>
      </div>
    </div>
  );
}

export function HqStories() {
  // Split into 3 columns, mirroring the reference layout.
  const cols: Testimonial[][] = [[], [], []];
  TESTIMONIALS.forEach((t, i) => cols[i % 3].push(t));
  const colClass = ["a", "b", "c"];

  return (
    <section className="stories" id="stories">
      <div className="wrap">
        <div
          className="num-row"
          data-reveal
          style={{ justifyContent: "center" }}
        >
          <span>04</span>
          <b>Stories</b>
        </div>
        <h2
          className="big"
          data-reveal
          style={staggerStyle(1, { textAlign: "center" })}
        >
          What agents say.
        </h2>
      </div>
      <div className="marquee">
        {cols.map((col, i) => (
          <div className={`mcol ${colClass[i]}`} key={i}>
            {/* duplicated for a seamless -50% scroll loop */}
            {[...col, ...col].map((t, j) => (
              <Card t={t} key={j} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
