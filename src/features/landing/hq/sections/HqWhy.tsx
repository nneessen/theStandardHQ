/*
 * "Why agents leave their IMO" — the cream contrast section with an old-way /
 * new-way compare grid. Content from COMPARE_OLD / COMPARE_NEW.
 */

import { staggerStyle } from "../lib/cssVar";
import { COMPARE_OLD, COMPARE_NEW } from "../data/content";

export function HqWhy() {
  return (
    <section className="cream" id="why">
      <div className="wrap">
        <div className="shead">
          <div className="num-row" data-reveal>
            <span>01</span>
            <span
              style={{
                width: "40px",
                height: "1px",
                background: "#0000002e",
                display: "block",
              }}
            />
            <b>Why agents leave their IMO</b>
          </div>
          <h2 className="big" data-reveal style={staggerStyle(1)}>
            The work other agencies
            <br />
            make you do, ours just does.
          </h2>
          <p className="lead" data-reveal style={staggerStyle(2)}>
            Most IMOs sell on commission splits. They forget to mention
            you&rsquo;ll spend half your week on the things below. We replaced
            every one with software.
          </p>
        </div>
        <div className="compare">
          <div className="old" data-reveal>
            <div className="col-head">✕ At your old IMO</div>
            {COMPARE_OLD.map((row) => (
              <div className="row" key={row.title}>
                <h3>{row.title}</h3>
                <p>{row.desc}</p>
              </div>
            ))}
          </div>
          <div className="new" data-reveal style={staggerStyle(1)}>
            <div className="col-head">
              ✓ At The Standard <span className="live">→ Live</span>
            </div>
            {COMPARE_NEW.map((row) => (
              <div className="row" key={row.title}>
                <h3>{row.title}</h3>
                <p>{row.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
