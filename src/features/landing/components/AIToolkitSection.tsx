import { ArrowRight } from "lucide-react";
import { AI_TOOLKIT } from "../data/ai-toolkit";
import { useReveal } from "../hooks/useReveal";

export function AIToolkitSection() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section
      id="ai-toolkit"
      className="surface-dark py-20 lg:py-28 relative overflow-hidden"
    >
      {/* Subtle floating shape on dark surface */}
      <div
        className="floating-shape"
        style={{
          width: 380,
          height: 380,
          top: "10%",
          right: "-100px",
          background:
            "radial-gradient(circle, rgba(226,255,204,0.12), transparent 65%)",
          borderRadius: "50%",
        }}
      />

      <div
        ref={ref}
        className="reveal relative z-10 max-w-7xl mx-auto px-6 lg:px-12"
      >
        <div className="max-w-3xl mb-16">
          <div className="section-eyebrow-row">
            <span className="section-eyebrow-num !text-[var(--landing-icy-blue)]/60">
              03
            </span>
            <span className="section-eyebrow-line !bg-[var(--landing-icy-blue)]/20" />
            <span className="section-eyebrow-label !text-[var(--landing-icy-blue)]/60">
              AI Toolkit
            </span>
          </div>

          <h2
            className="text-display-2xl mb-6 text-[var(--landing-icy-blue)]"
            style={{ fontWeight: 300 }}
          >
            Five AI capabilities
            <br />
            your last agency didn't have.
          </h2>
          <p className="text-fluid-lg text-[var(--landing-icy-blue)]/70 max-w-2xl">
            Built on Claude, Retell, and Close. Four are in production today.
            The fifth — Voice AI — is in active development. None of it is
            "coming soon" marketing copy.
          </p>
        </div>

        {/* gap-px lattice grid on dark — uses forest-green as cell separator */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          style={{ gap: "1px", background: "rgba(132, 144, 127, 0.18)" }}
        >
          {AI_TOOLKIT.map((cap) => {
            const Icon = cap.icon;
            const isWip = cap.status === "in-development";
            return (
              <div
                key={cap.id}
                className="group p-8 lg:p-10 transition-colors"
                style={{ background: "var(--landing-deep-green)" }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div
                    className="icon-container icon-container-lg"
                    style={{
                      background: "rgba(226, 255, 204, 0.08)",
                      borderColor: "rgba(226, 255, 204, 0.18)",
                      color: "var(--landing-adventure-yellow)",
                    }}
                  >
                    <Icon size={24} strokeWidth={1.5} />
                  </div>
                  {isWip ? (
                    <span className="badge badge-warning">In Development</span>
                  ) : (
                    <span className="badge badge-accent">Live</span>
                  )}
                </div>

                <h3 className="text-display-xl mb-3 text-[var(--landing-icy-blue)]">
                  {cap.title}
                </h3>
                <p className="text-sm font-medium text-[var(--landing-adventure-yellow)] mb-4 mono">
                  {cap.oneLiner}
                </p>
                <p className="text-sm text-[var(--landing-icy-blue)]/70 leading-relaxed mb-6">
                  {cap.body}
                </p>

                <div className="pt-5 border-t border-[var(--landing-icy-blue)]/15">
                  <p className="text-eyebrow !text-[var(--landing-icy-blue)]/50 mb-1">
                    Under the hood
                  </p>
                  <p className="text-xs text-[var(--landing-icy-blue)]/80 leading-relaxed">
                    {cap.proof}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-14 pt-10 border-t border-[var(--landing-icy-blue)]/15 flex items-center justify-between flex-wrap gap-4">
          <p className="text-sm text-[var(--landing-icy-blue)]/70">
            Want to see the platform up close?
          </p>
          <a
            href="#platform"
            className="inline-flex items-center gap-2 text-eyebrow-lg !text-[var(--landing-adventure-yellow)] hover:opacity-80 transition-opacity group"
          >
            Tour the eight pillars
            <ArrowRight
              size={16}
              strokeWidth={1.5}
              className="group-hover:translate-x-1 transition-transform"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
