// src/features/recruiting/layouts/NickCustomLayout.tsx
// Custom layout for /join-the-standard — mirrors the public landing page's
// editorial design DNA (Big Shoulders + JetBrains Mono, deep-green / icy-blue /
// adventure-yellow palette) but compressed into a single viewport with a
// drawer-based form so the page itself never scrolls on desktop or mobile.

import { useState } from "react";
import {
  Instagram,
  Phone,
  ArrowRight,
  Sparkles,
  Cpu,
  Network,
  Shield,
} from "lucide-react";
import { LeadInterestForm } from "../components/public/LeadInterestForm";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
// eslint-disable-next-line no-restricted-imports -- CSS side-effect import: scoped .theme-landing tokens shared with the public landing page
import "@/features/landing/styles/landing-theme.css";
import type { LayoutProps } from "./types";

const FALLBACK_HEADLINE_LINE_1 = "Join The";
const FALLBACK_HEADLINE_LINE_2 = "Standard";
const FALLBACK_SUBHEAD =
  "An agent-first operating system. AI-scored leads, an underwriting wizard for 30+ carriers, and commissions that calculate themselves.";

export function NickCustomLayout({
  theme,
  recruiterId,
  onFormSuccess,
}: LayoutProps) {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSuccess = (leadId: string) => {
    setFormSubmitted(true);
    onFormSuccess(leadId);
  };

  // Split a single-line theme.headline across two display lines if no <br>.
  const headlineRaw = theme.headline?.trim();
  const [hLine1, hLine2] = (() => {
    if (!headlineRaw)
      return [FALLBACK_HEADLINE_LINE_1, FALLBACK_HEADLINE_LINE_2];
    const parts = headlineRaw.split(/\s*\n\s*|\s+\|\s+/);
    if (parts.length >= 2) return [parts[0], parts.slice(1).join(" ")];
    const words = headlineRaw.split(/\s+/);
    if (words.length >= 4) {
      const mid = Math.ceil(words.length / 2);
      return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    }
    return [headlineRaw, ""];
  })();

  const subhead = theme.subheadline?.trim() || FALLBACK_SUBHEAD;

  return (
    <div className="theme-landing surface-base relative h-svh w-full overflow-hidden">
      {/* Topographic grid + floating shapes for editorial atmosphere */}
      <div className="topo-grid absolute inset-0 pointer-events-none" />
      <div
        className="floating-shape floating-shape-1 hidden md:block"
        style={{ top: "-6%", right: "-4%" }}
      />
      <div
        className="floating-shape floating-shape-2 hidden md:block"
        style={{ bottom: "8%", left: "-3%" }}
      />
      <div
        className="floating-shape floating-shape-ring hidden lg:block"
        style={{ top: "12%", left: "48%" }}
      />

      {/* Two-column on desktop; single column with sticky CTA on mobile */}
      <div className="relative z-10 h-full grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
        {/* ============ LEFT / HERO ============ */}
        <section className="flex h-full min-h-0 flex-col px-5 pt-5 pb-24 sm:px-8 lg:px-12 lg:py-10 xl:px-16">
          {/* Top bar: logo + agent login */}
          <header className="flex items-center justify-between flex-shrink-0">
            {theme.logo_dark_url || theme.logo_light_url ? (
              <img
                src={theme.logo_dark_url || theme.logo_light_url || undefined}
                alt="The Standard"
                className="h-8 w-auto object-contain sm:h-10 lg:h-11"
              />
            ) : (
              <span
                className="font-display font-black uppercase tracking-tight"
                style={{
                  fontSize: "1.25rem",
                  color: "var(--landing-deep-green)",
                }}
              >
                The Standard
              </span>
            )}

            <a
              href="/login"
              className="hidden sm:inline-flex landing-badge-pill hover:bg-[var(--landing-icy-blue-light)] transition-colors"
            >
              Agent Login
              <ArrowRight className="h-3 w-3" />
            </a>
          </header>

          {/* Center stack — flex-1 so it fills available space */}
          <div className="flex flex-1 min-h-0 flex-col justify-center py-4 sm:py-6 lg:py-2">
            {/* Pulse-glow recruiting badge + eyebrow row (matches public hero) */}
            <div className="inline-flex items-center gap-3 mb-5 lg:mb-7">
              <span
                className="pulse-glow inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] rounded-[2px] font-mono"
                style={{
                  background: "var(--landing-deep-green)",
                  color: "var(--landing-icy-blue)",
                }}
              >
                Recruiting Now
              </span>
              <span className="hidden sm:block w-10 h-px bg-[var(--landing-border)]" />
              <span className="hidden sm:inline text-eyebrow-lg">
                Exclusive Agent Opportunity
              </span>
            </div>

            {/* Display headline — two-line stack, light weight like public hero */}
            <h1 className="text-display-2xl" style={{ fontWeight: 300 }}>
              {hLine1}
              {hLine2 && (
                <>
                  <br />
                  <span style={{ fontWeight: 900 }}>{hLine2}</span>
                </>
              )}
            </h1>

            <p className="text-fluid-base text-muted mt-4 lg:mt-5 max-w-[40ch]">
              {subhead}
            </p>

            {/* Stat lattice — three pillars, hidden on smallest screens */}
            <div className="mt-6 lg:mt-8 hidden sm:grid lattice-grid grid-cols-3 max-w-md">
              <StatTile
                icon={<Cpu className="h-3.5 w-3.5" />}
                value="AI"
                label="Lead Scoring"
              />
              <StatTile
                icon={<Network className="h-3.5 w-3.5" />}
                value="30+"
                label="Carriers"
              />
              <StatTile
                icon={<Shield className="h-3.5 w-3.5" />}
                value="100%"
                label="In-House"
              />
            </div>

            {/* Desktop CTA row — opens form drawer */}
            <div className="mt-7 hidden lg:flex items-center gap-3">
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <button type="button" className="btn btn-cta btn-lg">
                    <Sparkles className="h-3.5 w-3.5" />
                    Apply to Join
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </SheetTrigger>
                <FormDrawer
                  open={sheetOpen}
                  recruiterId={recruiterId}
                  onSuccess={handleSuccess}
                  formSubmitted={formSubmitted}
                  ctaText={theme.cta_text || "Submit Application"}
                />
              </Sheet>

              {theme.calendly_url && (
                <a
                  href={theme.calendly_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-lg"
                >
                  Schedule a Call
                </a>
              )}
            </div>
          </div>

          {/* Bottom contact row */}
          <div className="flex-shrink-0 flex flex-wrap items-center gap-4 sm:gap-5 pt-4 mt-auto border-t border-[var(--landing-border)]">
            {theme.support_phone && (
              <a
                href={`tel:${theme.support_phone}`}
                className="group inline-flex items-center gap-2 text-eyebrow hover:text-[var(--landing-deep-green)] transition-colors"
              >
                <span className="landing-icon-tile h-7 w-7 group-hover:bg-[var(--landing-adventure-yellow)] group-hover:border-[var(--landing-adventure-yellow)] transition-colors">
                  <Phone className="h-3 w-3" />
                </span>
                <span className="font-mono">{theme.support_phone}</span>
              </a>
            )}
            {theme.social_links?.instagram && (
              <a
                href={theme.social_links.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-eyebrow hover:text-[var(--landing-deep-green)] transition-colors"
              >
                <span className="landing-icon-tile h-7 w-7 group-hover:bg-[var(--landing-adventure-yellow)] group-hover:border-[var(--landing-adventure-yellow)] transition-colors">
                  <Instagram className="h-3 w-3" />
                </span>
                <span className="font-mono">@thestandard.hq</span>
              </a>
            )}
            <span className="ml-auto text-eyebrow font-mono opacity-70 hidden sm:inline">
              © {new Date().getFullYear()} The Standard
            </span>
          </div>
        </section>

        {/* ============ RIGHT / FORM PANEL (desktop only) ============ */}
        <aside className="hidden lg:flex h-full min-h-0 flex-col surface-paper border-l border-[var(--landing-border-strong)]">
          <div className="flex-1 min-h-0 overflow-y-auto p-8 xl:p-10">
            <FormPanel
              recruiterId={recruiterId}
              onSuccess={handleSuccess}
              formSubmitted={formSubmitted}
              ctaText={theme.cta_text || "Submit Application"}
            />
            {theme.disclaimer_text && (
              <p className="mt-6 text-eyebrow font-mono leading-relaxed opacity-80">
                {theme.disclaimer_text}
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* ============ MOBILE STICKY CTA ============ */}
      <div className="lg:hidden absolute inset-x-0 bottom-0 z-20 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 bg-gradient-to-t from-[var(--landing-icy-blue)] via-[var(--landing-icy-blue)] to-transparent">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="btn btn-cta btn-lg w-full justify-center"
            >
              <Sparkles className="h-4 w-4" />
              Apply to Join
              <ArrowRight className="h-4 w-4" />
            </button>
          </SheetTrigger>
          <FormDrawer
            open={sheetOpen}
            recruiterId={recruiterId}
            onSuccess={handleSuccess}
            formSubmitted={formSubmitted}
            ctaText={theme.cta_text || "Submit Application"}
            mobile
          />
        </Sheet>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="lattice-cell !p-3 flex flex-col gap-1">
      <span className="text-eyebrow inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span
        className="font-display font-black tabular leading-none"
        style={{
          fontSize: "1.5rem",
          color: "var(--landing-deep-green)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function FormPanel({
  recruiterId,
  onSuccess,
  formSubmitted,
  ctaText,
}: {
  recruiterId: string;
  onSuccess: (leadId: string) => void;
  formSubmitted: boolean;
  ctaText: string;
}) {
  if (formSubmitted) {
    return (
      <div className="text-center py-8">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[2px]"
          style={{
            background: "var(--landing-adventure-yellow)",
            color: "var(--landing-deep-green)",
          }}
        >
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-display-xl mb-2">You&apos;re In</h3>
        <p className="text-fluid-base text-muted">
          We&apos;ll be in touch within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="section-eyebrow-row mb-4">
        <span className="section-eyebrow-num">02</span>
        <span className="section-eyebrow-line" />
        <span className="section-eyebrow-label">Apply</span>
      </div>
      <h2 className="text-display-xl mb-2">Ready to Talk?</h2>
      <p className="text-fluid-base text-muted mb-6">
        Drop your info and I&apos;ll reach out personally.
      </p>
      <LeadInterestForm
        recruiterSlug={recruiterId}
        onSuccess={onSuccess}
        ctaText={ctaText}
        darkMode={false}
      />
    </>
  );
}

function FormDrawer({
  open,
  recruiterId,
  onSuccess,
  formSubmitted,
  ctaText,
  mobile = false,
}: {
  open: boolean;
  recruiterId: string;
  onSuccess: (leadId: string) => void;
  formSubmitted: boolean;
  ctaText: string;
  mobile?: boolean;
}) {
  if (!open) return null;

  return (
    <SheetContent
      side={mobile ? "bottom" : "right"}
      size={mobile ? "full" : "lg"}
      className="theme-landing surface-paper p-0 border-l border-[var(--landing-border-strong)] flex flex-col"
    >
      <SheetTitle className="sr-only">Apply to Join The Standard</SheetTitle>
      <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8">
        <FormPanel
          recruiterId={recruiterId}
          onSuccess={onSuccess}
          formSubmitted={formSubmitted}
          ctaText={ctaText}
        />
      </div>
    </SheetContent>
  );
}

export default NickCustomLayout;
