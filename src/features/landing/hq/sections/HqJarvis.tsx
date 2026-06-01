/*
 * Jarvis showcase — a REAL screenshot of the Jarvis Command Center (the agent's
 * AI surface) paired with a canned typewriter demo. This is a SHOWCASE: it never
 * invokes the real assistant (Jarvis is gated to authenticated internal users).
 * The "Ask Jarvis" CTA routes to Apply; "See the AI toolkit" scrolls to toolkit.
 */

import { Link } from "@tanstack/react-router";
import { staggerStyle } from "../lib/cssVar";
import { APPLY_PATH } from "../lib/links";
import { useJarvisTypewriter } from "../lib/useJarvisTypewriter";
import { JARVIS_DEMO } from "../data/content";
import { PRODUCT_SCREENSHOTS } from "../data/product-screenshots";

export function HqJarvis({ reducedMotion }: { reducedMotion: boolean }) {
  const { you, jarvis } = useJarvisTypewriter(JARVIS_DEMO, reducedMotion);
  // The Command Center capture IS Jarvis's real UI → it's the primary image here.
  const cc = PRODUCT_SCREENSHOTS[0];

  return (
    <section className="jarvis" id="jarvis">
      <div className="aurora" />
      <div className="wrap">
        <div className="jarvis-grid">
          <div className="jarvis-copy">
            <div className="eyebrow" data-reveal>
              Your personal AI · Always on
            </div>
            <h2 className="big" data-reveal style={staggerStyle(1)}>
              Meet <span className="jx">Jarvis</span>.
            </h2>
            <p className="lead" data-reveal style={staggerStyle(2)}>
              An agent&rsquo;s personal AI assistant that does literally
              anything you ask — score a lead, write the email, book the call,
              draft the underwriting, build the report. You talk. Jarvis does.
            </p>
            <div className="jarvis-demo" data-reveal style={staggerStyle(3)}>
              <div className="jd-line">
                <span className="jd-you">You</span>
                <span>{you}</span>
                <span className="jd-caret">▋</span>
              </div>
              <div className="jd-line jd-do">
                <span className="jd-j">Jarvis</span>
                <span>{jarvis}</span>
              </div>
            </div>
            <div className="jarvis-cta" data-reveal style={staggerStyle(4)}>
              <Link to={APPLY_PATH} className="btn btn-jarvis" data-magnet>
                <span data-scramble-hover="ASK JARVIS">Ask Jarvis</span>
              </Link>
              <a className="btn btn-ghost" href="#ai">
                See the AI toolkit
              </a>
            </div>
          </div>
          {cc && (
            <div
              className="cmd-stage"
              data-reveal
              style={staggerStyle(2, { marginTop: 0 })}
            >
              <div className="cmd-card" data-tilt-card>
                <img
                  src={cc.src}
                  alt="The Jarvis Command Center"
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
