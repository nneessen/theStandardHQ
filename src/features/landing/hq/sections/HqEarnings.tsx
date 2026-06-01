/*
 * Earnings & comp — copy column + 4 rotating-cross cards. id="earnings".
 * Content from EARNINGS. The cross SVG spins via CSS (per-card direction/speed).
 */

import { staggerStyle } from "../lib/cssVar";
import { Icon } from "../lib/icons";
import { EARNINGS } from "../data/content";

function Cross() {
  return (
    <svg className="cross" viewBox="0 0 130 130" fill="none" aria-hidden="true">
      <path
        d="M11 11L118.899 119M11.101 119L119 11"
        stroke="currentColor"
        strokeWidth="26"
      />
    </svg>
  );
}

export function HqEarnings() {
  return (
    <section className="earnings" id="earnings">
      <div className="wrap">
        <div className="earn-wrap">
          <div className="earn-body">
            <div className="num-row" data-reveal>
              <span>·</span>
              <b>Earnings &amp; comp</b>
            </div>
            <h2 className="big" data-reveal style={staggerStyle(1)}>
              The check shows up.
              <br />
              The math is already done.
            </h2>
            <p className="lead" data-reveal style={staggerStyle(2)}>
              Most agents leave their first IMO over commission disputes. We
              removed the dispute by making the math visible, automatic, and
              auditable.
            </p>
            <p className="lead" data-reveal style={staggerStyle(3)}>
              Pull up the comp guide and see the rate. Pull up your dashboard
              and see what you&rsquo;ve earned, what&rsquo;s advanced,
              what&rsquo;s in chargeback risk, and what your downline is
              generating.
            </p>
          </div>
          <div className="earn-cards">
            {EARNINGS.map((card) => (
              <div className="ecard" data-reveal key={card.title}>
                <Cross />
                <div className="eic">
                  <Icon name={card.icon} />
                </div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
