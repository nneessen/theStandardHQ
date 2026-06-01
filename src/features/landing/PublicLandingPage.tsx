/*
 * The Standard HQ — public (pre-login) landing page.
 *
 * A faithful React port of the reference design in
 * docs/todo/"The Standard HQ - Landing.html". Everything is scoped to the
 * `.theme-hq` wrapper + hq/styles/hq-theme.css so it never leaks into the app or
 * the recruiting funnel (which use the separate, untouched `.theme-landing`).
 *
 * Composition only: each section is a self-contained component under hq/sections,
 * fed by static typed content in hq/data. One useEffect wires the imperative
 * animation layer (hq/lib/initLandingEffects) to the rendered DOM and tears it
 * down on unmount. The Supabase theme fetch is used ONLY for meta tags (SEO),
 * preserving prior behavior; section copy is static recruiting content.
 *
 * Stories (testimonials) and Culture (photos) render only when their data files
 * are populated — no placeholder/mock content ships.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import "./hq/styles/hq-theme.css";

import { HqNav } from "./hq/components/HqNav";
import { HqFooter } from "./hq/components/HqFooter";
import { HqJarvisFab } from "./hq/components/HqJarvisFab";
import { HqHero } from "./hq/sections/HqHero";
import { HqStats, HqOppStats } from "./hq/sections/HqStats";
import { HqJarvis } from "./hq/sections/HqJarvis";
import { HqPillars } from "./hq/sections/HqPillars";
import { HqGallery } from "./hq/sections/HqGallery";
import { HqCommandCenter } from "./hq/sections/HqCommandCenter";
import { HqWhy } from "./hq/sections/HqWhy";
import { HqToolkit } from "./hq/sections/HqToolkit";
import { HqInventory } from "./hq/sections/HqInventory";
import { HqFounder } from "./hq/sections/HqFounder";
import { HqCulture } from "./hq/sections/HqCulture";
import { HqPath } from "./hq/sections/HqPath";
import { HqEarnings } from "./hq/sections/HqEarnings";
import { HqStories } from "./hq/sections/HqStories";
import { HqFaq } from "./hq/sections/HqFaq";
import { HqKinetic } from "./hq/sections/HqKinetic";
import { HqCta } from "./hq/sections/HqCta";
import { initLandingEffects } from "./hq/lib/initLandingEffects";
import { TESTIMONIALS } from "./hq/data/testimonials";
import { CULTURE_PHOTOS } from "./hq/data/culture";

import * as landingPageService from "./services/landingPageService";
import type { LandingPageTheme } from "./types";
import { DEFAULT_LANDING_PAGE_THEME } from "./types";

export function PublicLandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() === true;
  const [theme, setTheme] = useState<LandingPageTheme>(
    DEFAULT_LANDING_PAGE_THEME,
  );

  // Imperative animation layer (reveal / count-up / scramble / glow / tilt /
  // magnet / nav-progress / hscroll / scroll-tilt / kinetic / rain / anchors).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cleanup = initLandingEffects(root, { reducedMotion: reduced });
    return cleanup;
  }, [reduced]);

  // Theme fetch — used only for meta tags (SEO); section copy is static.
  useEffect(() => {
    let mounted = true;
    landingPageService
      .getPublicLandingPageSettings()
      .then((result) => {
        if (mounted) setTheme(result);
      })
      .catch(() => {
        // defaults already set
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.title = theme.meta_title;
    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        const [, key] = selector.match(/\[([^=]+)="([^"]+)"\]/) ?? [];
        if (key) el.setAttribute(key, selector.match(/="([^"]+)"/)?.[1] ?? "");
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };
    if (theme.meta_description) {
      setMeta('meta[name="description"]', "content", theme.meta_description);
    }
    if (theme.og_image_url) {
      setMeta('meta[property="og:image"]', "content", theme.og_image_url);
    }
  }, [theme]);

  const showStories = TESTIMONIALS.length > 0;
  const showCulture = CULTURE_PHOTOS.length > 0;

  return (
    <div ref={rootRef} className="theme-hq">
      <HqNav />

      <main>
        <HqHero reducedMotion={reduced} />
        <HqStats />
        <HqJarvis reducedMotion={reduced} />
        <HqPillars />
        <HqGallery reducedMotion={reduced} />
        <HqCommandCenter />
        <HqWhy />
        <HqToolkit />
        <HqInventory />
        <HqFounder />
        {showCulture && <HqCulture />}
        <HqPath />
        <HqEarnings />
        {showStories && <HqStories />}
        <HqOppStats />
        <HqFaq />
        <HqKinetic />
        <HqCta />
      </main>

      <HqJarvisFab />
      <HqFooter />
    </div>
  );
}
