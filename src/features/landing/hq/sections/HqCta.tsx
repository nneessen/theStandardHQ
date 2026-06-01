/*
 * Final CTA — cinematic close with aurora + scramble headline. Apply → Apply
 * route; "Meet Jarvis first" → Jarvis showcase anchor. id="cta".
 */

import { Link } from "@tanstack/react-router";
import { staggerStyle } from "../lib/cssVar";
import { APPLY_PATH } from "../lib/links";

export function HqCta() {
  return (
    <section className="cta" id="cta">
      <div className="aurora" />
      <div className="wrap">
        <div className="eyebrow center" data-reveal>
          / Apply · invitation-only /
        </div>
        <h2 data-reveal style={staggerStyle(1)} data-scramble="READY TO START?">
          READY TO START?
        </h2>
        <p className="sub" data-reveal style={staggerStyle(2)}>
          Your future is waiting. So is Jarvis.
        </p>
        <div className="cta-btns" data-reveal style={staggerStyle(3)}>
          <Link to={APPLY_PATH} className="btn btn-jarvis" data-magnet>
            <span data-scramble-hover="APPLY NOW">Apply now</span>
          </Link>
          <a className="btn btn-ghost" href="#jarvis">
            Meet Jarvis first
          </a>
        </div>
        <div className="fine" data-reveal style={staggerStyle(4)}>
          No application fee · No long sales pitch · We respect your time
        </div>
      </div>
    </section>
  );
}
