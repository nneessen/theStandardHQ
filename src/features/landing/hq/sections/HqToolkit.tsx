/*
 * AI Toolkit — five capability tilt cards with LIVE/DEV badges. id="ai" is a
 * nav anchor target. Content from TOOLKIT.
 */

import { staggerStyle } from "../lib/cssVar";
import { Icon } from "../lib/icons";
import { TOOLKIT } from "../data/content";

export function HqToolkit() {
  return (
    <section className="toolkit" id="ai">
      <div className="wrap">
        <div className="num-row" data-reveal>
          <span>03</span>
          <b>AI Toolkit</b>
        </div>
        <h2 className="big" data-reveal style={staggerStyle(1)}>
          Four AI capabilities
          <br />
          your last agency didn&rsquo;t have.
        </h2>
        <p className="lead" data-reveal style={staggerStyle(2)}>
          Built in-house and running in production today — all four are live
          now. None of it is &ldquo;coming soon&rdquo; marketing copy.
        </p>
        <div className="tk-grid">
          {TOOLKIT.map((t) => (
            <div className="tilt" data-tilt data-reveal key={t.title}>
              <span className={`badge ${t.badge === "LIVE" ? "live" : "dev"}`}>
                {t.badge === "LIVE" ? "→ LIVE" : "⚙ DEV"}
              </span>
              <div className="tk-ic">
                <Icon name={t.icon} />
              </div>
              <h3>{t.title}</h3>
              <div className="tk-tag">{t.tag}</div>
              <p>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
