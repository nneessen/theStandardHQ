/*
 * Eight platform pillars in a horizontal scroll-pin track (data-hscroll /
 * data-htrack drive the translateX in initLandingEffects; on mobile / reduced
 * motion the CSS un-pins and stacks them vertically).
 */

import { staggerStyle } from "../lib/cssVar";
import { Icon } from "../lib/icons";
import { PILLARS } from "../data/content";

export function HqPillars() {
  return (
    <section className="pillars" data-hscroll id="pillars">
      <div className="pin">
        <div className="phead">
          <div className="num-row" data-reveal>
            <span>·</span>
            <b>Seven pillars · one operating system</b>
          </div>
          <h2 className="big" data-reveal style={staggerStyle(1)}>
            Seven pillars.
            <br />
            One operating system.
          </h2>
        </div>
        <div className="ph-track" data-htrack>
          {PILLARS.map((p) => (
            <div className="pcard" key={p.num}>
              <div className="pn">
                {p.num} · {p.category}
              </div>
              <div className="pic">
                <Icon name={p.icon} />
              </div>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
              <div className="pbig">{p.num}</div>
            </div>
          ))}
        </div>
        <div className="ph-hint">← Scroll to move through all seven →</div>
      </div>
    </section>
  );
}
