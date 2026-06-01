/*
 * Command Center — a 3D scroll-tilt frame (data-tilt-card drives the perspective
 * reveal in initLandingEffects) wrapping a REAL screenshot of the main dashboard.
 *
 * Content honesty: this section renders ONLY when a real screenshot is supplied
 * (PRODUCT_SCREENSHOTS[0]); the page guards it. The earlier fabricated-KPI mock
 * was removed — we never present invented numbers as the real product.
 */

import { staggerStyle } from "../lib/cssVar";
import { PRODUCT_SCREENSHOTS } from "../data/product-screenshots";

export function HqCommandCenter() {
  const shot = PRODUCT_SCREENSHOTS[0];
  if (!shot) return null;

  return (
    <section className="cmd" id="command">
      <div className="wrap">
        <div
          className="num-row"
          data-reveal
          style={{ justifyContent: "center" }}
        >
          <span>·</span>
          <b>Main Dashboard</b>
        </div>
        <h2
          className="big"
          data-reveal
          style={staggerStyle(1, { textAlign: "center" })}
        >
          Your day in one screen.
        </h2>
        <p
          className="lead"
          data-reveal
          style={staggerStyle(2, {
            margin: "22px auto 0",
            textAlign: "center",
          })}
        >
          Pace toward your monthly target, commission MTD, where you sit on the
          team leaderboard, and a live activity feed. Open your laptop — see
          exactly what to do next.
        </p>
        <div className="cmd-stage">
          <div className="cmd-card" data-tilt-card>
            <img
              src={shot.src}
              alt={shot.label}
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
