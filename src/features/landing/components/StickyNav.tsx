import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GoldCTAButton } from "./GoldCTAButton";
import type { LandingPageTheme } from "../types";

const NAV_LINKS = [
  { id: "platform", label: "Platform", href: "#platform" },
  { id: "ai", label: "AI", href: "#ai-toolkit" },
  { id: "opportunity", label: "Opportunity", href: "#opportunity" },
  { id: "stories", label: "Stories", href: "#stories" },
  { id: "faq", label: "FAQ", href: "#faq" },
];

interface Props {
  theme: LandingPageTheme;
}

export function StickyNav({ theme }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const logoSrc = theme.logo_dark_url || theme.logo_light_url;

  return (
    <nav className={`theme-landing-nav ${scrolled ? "scrolled" : ""}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {logoSrc ? (
            <img src={logoSrc} alt="The Standard" className="h-8 w-auto" />
          ) : (
            <span className="font-display text-xl font-semibold text-[var(--landing-navy)]">
              The Standard
            </span>
          )}
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className="text-sm font-medium text-[var(--landing-slate)] hover:text-[var(--landing-navy)] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden sm:inline-flex text-sm font-medium text-[var(--landing-slate)] hover:text-[var(--landing-navy)] transition-colors"
          >
            Agent Login
          </Link>
          <GoldCTAButton
            to="/join-the-standard"
            className="!px-4 !py-2 !text-sm"
          >
            Apply
          </GoldCTAButton>
        </div>
      </div>
    </nav>
  );
}
