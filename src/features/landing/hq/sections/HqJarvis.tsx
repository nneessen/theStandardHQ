/*
 * Jarvis showcase — orb + orbiting capability chips + a canned typewriter demo
 * + capability tilt cards. This is a SHOWCASE: it never invokes the real
 * assistant (Jarvis is gated to authenticated internal users). The "Ask Jarvis"
 * CTA routes to Apply; "See the AI toolkit" scrolls to the toolkit section.
 */

import { Link } from "@tanstack/react-router";
import { staggerStyle } from "../lib/cssVar";
import { APPLY_PATH } from "../lib/links";
import { useJarvisTypewriter } from "../lib/useJarvisTypewriter";
import { JARVIS_CHIPS, JARVIS_DEMO } from "../data/content";

export function HqJarvis({ reducedMotion }: { reducedMotion: boolean }) {
  const { you, jarvis } = useJarvisTypewriter(JARVIS_DEMO, reducedMotion);

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
          <div className="jarvis-orb" data-reveal style={staggerStyle(2)}>
            <div className="orb">
              <span className="ring" />
              <span className="ring r2" />
              <span className="ring r3" />
              <span className="opulse" />
              <span className="core" />
            </div>
            <div className="orb-chips">
              {JARVIS_CHIPS.map((c, i) => {
                const a = (i / JARVIS_CHIPS.length) * Math.PI * 2 - Math.PI / 2;
                const R = 178;
                return (
                  <span
                    className="ochip"
                    key={c}
                    style={{
                      transform: `translate(${Math.round(Math.cos(a) * R)}px,${Math.round(Math.sin(a) * R)}px)`,
                      animationDelay: `${i * 0.5}s`,
                    }}
                  >
                    {c}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
