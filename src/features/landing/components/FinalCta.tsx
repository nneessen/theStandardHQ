import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { LandingPageTheme } from "../types";
import { useReveal } from "../hooks/useReveal";

interface Props {
  theme: LandingPageTheme;
}

export function FinalCta({ theme }: Props) {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="surface-dark py-24 lg:py-32 relative overflow-hidden">
      <div
        className="floating-shape"
        style={{
          width: 520,
          height: 520,
          top: "-180px",
          left: "-100px",
          background:
            "radial-gradient(circle, rgba(226,255,204,0.16), transparent 65%)",
          borderRadius: "50%",
        }}
      />
      <div
        className="floating-shape"
        style={{
          width: 360,
          height: 360,
          bottom: "-180px",
          right: "5%",
          background:
            "radial-gradient(circle, rgba(226,255,204,0.10), transparent 70%)",
          borderRadius: "50%",
        }}
      />

      <div
        ref={ref}
        className="reveal relative z-10 max-w-4xl mx-auto px-6 lg:px-12 text-center"
      >
        <div
          className="section-eyebrow-row justify-center"
          style={{ justifyContent: "center" }}
        >
          <span className="section-eyebrow-num !text-[var(--landing-icy-blue)]/60">
            /
          </span>
          <span className="section-eyebrow-line !bg-[var(--landing-icy-blue)]/20" />
          <span className="section-eyebrow-label !text-[var(--landing-adventure-yellow)]">
            Apply
          </span>
          <span className="section-eyebrow-line !bg-[var(--landing-icy-blue)]/20" />
          <span className="section-eyebrow-num !text-[var(--landing-icy-blue)]/60">
            /
          </span>
        </div>

        <h2
          className="text-display-3xl text-[var(--landing-icy-blue)] mb-6"
          style={{ fontWeight: 300 }}
        >
          {theme.final_cta_headline ||
            "Ready to join the only agency with this stack?"}
        </h2>
        <p className="text-fluid-lg text-[var(--landing-icy-blue)]/70 mb-12 max-w-2xl mx-auto">
          {theme.final_cta_subheadline ||
            "Apply now. We review your background and reach out within 48 hours. If it's a fit, you're working inside the platform within the week."}
        </p>
        <Link
          to={theme.final_cta_link || "/join-the-standard"}
          className="btn btn-cta btn-lg"
        >
          {theme.final_cta_text || "Apply to Join"}
          <ArrowRight size={16} strokeWidth={1.75} />
        </Link>
        <p className="text-eyebrow !text-[var(--landing-icy-blue)]/40 mt-8">
          No application fee · No long sales pitch · We respect your time
        </p>
      </div>
    </section>
  );
}
