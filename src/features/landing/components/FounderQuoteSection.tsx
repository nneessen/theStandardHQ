import { useReveal } from "../hooks/useReveal";

interface Props {
  quote?: string;
  authorName?: string;
  authorTitle?: string;
  authorImageUrl?: string;
}

const DEFAULT_QUOTE =
  "I built this software because I was the agent doing the busywork. Manually scoring leads, copy-pasting templates, fighting with my comp spreadsheet, watching my downline lose recruits to bad onboarding. So I built around it. Now we're recruiting agents who want what I have — software that does the work, not just tracks it.";

export function FounderQuoteSection({
  quote = DEFAULT_QUOTE,
  authorName = "Nick Neessen",
  authorTitle = "Founder · Producer · Engineer",
  authorImageUrl,
}: Props) {
  const ref = useReveal<HTMLDivElement>();
  const initials = authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <section className="surface-base py-20 lg:py-28 relative overflow-hidden">
      <div
        className="floating-shape"
        style={{
          width: 360,
          height: 360,
          top: "-80px",
          right: "8%",
          background:
            "radial-gradient(circle, rgba(226,255,204,0.2), transparent 65%)",
          borderRadius: "50%",
        }}
      />

      <div
        ref={ref}
        className="reveal relative max-w-5xl mx-auto px-6 lg:px-12"
      >
        <div className="surface-dark p-10 lg:p-16 relative overflow-hidden">
          <div
            className="floating-shape"
            style={{
              width: 280,
              height: 280,
              bottom: "-60px",
              right: "-60px",
              background:
                "radial-gradient(circle, rgba(226,255,204,0.12), transparent 65%)",
              borderRadius: "50%",
            }}
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-8 lg:gap-12 items-start">
            {/* Photo or initials block */}
            <div className="relative">
              {authorImageUrl ? (
                <div className="aspect-square w-32 lg:w-full overflow-hidden border border-[var(--landing-adventure-yellow)]/40">
                  <img
                    src={authorImageUrl}
                    alt={authorName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-square w-32 lg:w-full bg-[var(--landing-forest-green)] flex items-center justify-center border border-[var(--landing-adventure-yellow)]/30">
                  <span
                    className="text-display-3xl"
                    style={{
                      color: "var(--landing-adventure-yellow)",
                      fontWeight: 900,
                    }}
                  >
                    {initials}
                  </span>
                </div>
              )}
              <div className="mt-4">
                <p
                  className="text-display-xl text-[var(--landing-icy-blue)] mb-1"
                  style={{ fontWeight: 700 }}
                >
                  {authorName}
                </p>
                <p className="text-eyebrow !text-[var(--landing-icy-blue)]/60">
                  {authorTitle}
                </p>
              </div>
            </div>

            {/* Quote */}
            <div>
              <div
                className="quote-mark mb-2"
                style={{
                  color: "var(--landing-adventure-yellow)",
                  opacity: 0.7,
                }}
              >
                "
              </div>
              <p className="text-fluid-lg lg:text-xl text-[var(--landing-icy-blue)] leading-relaxed">
                {quote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
