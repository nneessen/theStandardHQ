/*
 * Main Dashboard ("The Board") — a 3D scroll-tilt frame (data-tilt-card drives
 * the perspective reveal in initLandingEffects) wrapping a REAL screenshot of
 * the authenticated dashboard. This is the DASHBOARD — NOT the Jarvis Command
 * Center, which now lives in HqJarvis.
 *
 * Content honesty: renders ONLY when a real Board screenshot exists
 * (DASHBOARD_SHOT). It stays null until a Slack/Discord-free capture is cropped
 * to public/landing/screens/, so nothing ships until then — no placeholder.
 * (Section id/class remain "command"/"cmd" to preserve existing CSS + anchors.)
 */

import { staggerStyle } from "../lib/cssVar";
import { DASHBOARD_SHOT } from "../data/product-screenshots";

export function HqCommandCenter() {
  const shot = DASHBOARD_SHOT;
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
