/*
 * Fixed top nav + scroll-progress bar. Section links are in-page anchors
 * (smooth-scrolled by initLandingEffects); real CTAs use the router:
 * Agent Login → /login, Apply → /join-the-standard.
 */

import { Link } from "@tanstack/react-router";
import { APPLY_PATH } from "../lib/links";

export function HqNav() {
  return (
    <>
      <div className="progress" data-progress />
      <nav className="hq-nav" data-nav>
        <a className="brand" href="#top">
          THE STANDARD <span className="hq-tag">HQ</span>
        </a>
        <div className="navlinks">
          <a href="#platform">Platform</a>
          <a href="#ai">AI</a>
          <a href="#founder">Opportunity</a>
          <a href="#stories">Stories</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="navcta">
          <Link to="/login" className="login">
            Agent Login
          </Link>
          <Link to={APPLY_PATH} className="btn btn-pri" data-magnet>
            Apply →
          </Link>
        </div>
      </nav>
    </>
  );
}
