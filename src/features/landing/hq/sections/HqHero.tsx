/*
 * Hero — scramble headline over the lazy WebGL line-burst background.
 * Primary CTA → Apply; secondary → in-page platform anchor.
 * The shader canvas is only rendered when motion is allowed.
 */

import { Link } from "@tanstack/react-router";
import { HeroShaderCanvasLazy } from "../three/HeroShaderCanvasLazy";
import { APPLY_PATH } from "../lib/links";

export function HqHero({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <header className="hero" id="top">
      {!reducedMotion && <HeroShaderCanvasLazy className="hero-shader" />}
      <div className="wrap">
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
          <strong>Now hiring &mdash; licensed &amp; unlicensed agents.</strong>{" "}
          Ditch the 12-hour days. We work{" "}
          <strong>10&nbsp;AM&ndash;5&nbsp;PM ET</strong>, Monday&ndash;Friday
          &mdash; <strong>no weekends</strong>. Every lead is inbound, so you
          never make a single cold call, and most agents take just{" "}
          <strong>3&ndash;6 calls a day</strong>. Agency-wide we close about{" "}
          <strong>33%</strong> at roughly <strong>$170</strong> cost per
          acquisition.
        </p>
        <div className="hero-cta">
          <Link to={APPLY_PATH} className="btn btn-pri" data-magnet>
            Start your journey →
          </Link>
          <a className="btn btn-ghost" href="#platform">
            Tour the platform
          </a>
        </div>
        <div className="hero-feats">
          <div className="hero-feat">
            <span className="d">✦</span> Production AI Toolkit
          </div>
          <div className="hero-feat">
            <span className="d">▦</span> Built In-House
          </div>
          <div className="hero-feat">
            <span className="d">⤢</span> 100% Remote
          </div>
        </div>
      </div>
    </header>
  );
}
