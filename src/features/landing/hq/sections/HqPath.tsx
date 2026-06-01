/*
 * "Your Path" — Join / Train / Earn / Lead, spring-stack reveal with an
 * animated progression spine (the .ln fill is driven by the .in class added by
 * the reveal observer). id="opportunity". Content from PATH.
 */

import { staggerStyle } from "../lib/cssVar";
import { PATH } from "../data/content";

export function HqPath() {
  return (
    <section className="path" id="opportunity">
      <div className="wrap">
        <div className="eyebrow" data-reveal>
          The Opportunity
        </div>
        <h2 className="big" data-reveal style={staggerStyle(1)}>
          Your path.
        </h2>
        <p className="lead" data-reveal style={staggerStyle(2)}>
          From day one to agency ownership.
        </p>
        <div className="path-grid">
          {PATH.map((step, i) => (
            <div
              className="pstep spring"
              data-reveal
              style={staggerStyle(i)}
              key={step.num}
            >
              <div className="ln">
                <span className="node" />
              </div>
              <div className="pn">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              <div className="sup">
                <div className="l">Platform support</div>
                <div className="t">{step.supportTitle}</div>
                <p>{step.supportDesc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
