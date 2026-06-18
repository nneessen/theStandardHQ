/*
 * Hero — scramble headline over the lazy WebGL line-burst background.
 * Copy left; a single real dashboard ("The Board") screenshot right. Primary
 * CTA → Apply; secondary → platform anchor. The shader canvas is only rendered
 * when motion is allowed.
 *
 * No eyebrow badge, no stat strip. The supporting line is a lede (lead sentence
 * + muted detail). The dashboard image is a fresh high-DPI capture of /dashboard
 * (sidebar cropped) — see scripts/capture-landing-dashboard.py.
 */

import { Link } from "@tanstack/react-router";
import { HeroShaderCanvasLazy } from "../three/HeroShaderCanvasLazy";
import { APPLY_PATH } from "../lib/links";

export function HqHero({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <header className="hero" id="top">
      {!reducedMotion && <HeroShaderCanvasLazy className="hero-shader" />}
      <div className="wrap">
        <div className="hero-grid">
          <div className="hero-copy">
            <h1 className="hero-title">
              <span data-scramble="THE STANDARD">THE STANDARD</span>
              <br />
              <span className="blue" data-scramble="HQ">
                HQ
              </span>
            </h1>
            <p className="hero-sub">
              The intelligent platform behind high-performing insurance agents.
              Built in-house, by a producer, for producers.
            </p>
            <p className="hero-hiring">
              <span className="lede">
                Every lead is inbound, so you never make a cold call.
              </span>
              Most agents run just 3&ndash;6 warm calls a day, 10 to 5 Eastern,
              Monday to Friday. No 12-hour grind, no weekends.
            </p>
            <div className="hero-cta">
              <Link to={APPLY_PATH} className="btn btn-pri" data-magnet>
                Apply now →
              </Link>
              <a className="btn btn-ghost" href="#platform">
                See the platform
              </a>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <figure className="hero-frame">
              <img
                src="/landing/screens/screen-dashboard.png"
                alt=""
                loading="eager"
                decoding="async"
              />
            </figure>
          </div>
        </div>
      </div>
    </header>
  );
}
