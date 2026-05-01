import { User } from "lucide-react";
import type { LandingPageTheme } from "../types";
import { useReveal } from "../hooks/useReveal";

interface Props {
  theme: LandingPageTheme;
}

const FALLBACK_PARAGRAPHS = [
  "I'm not a call center disguised as an agency. I'm a producer who got tired of paying $500/month for tools that didn't talk to each other, manually reconciling commissions in Excel, and watching good leads die because nobody picked up the phone in time.",
  "So I built my own platform. AI scores every lead in our Close pipeline. AI writes our outbound sequences. The underwriting wizard recommends carriers in three minutes. Training is a game with badges and leaderboards. Commissions calculate themselves — advances, chargebacks, persistency, override roll-ups, all automatic.",
  "Now I'm recruiting agents who want to work with software that actually moves the needle. If you've been at an IMO that hands you a CRM login and a phone, you already know exactly what we're talking about.",
];

const FOUNDER_NAME = "Nick Neessen";
const FOUNDER_TITLE = "Founder · Producer · Engineer";

export function AboutSection({ theme }: Props) {
  const ref = useReveal<HTMLDivElement>();
  const photoUrl = theme.about_image_url;

  const content =
    theme.about_content &&
    theme.about_content.length > 50 &&
    theme.about_content !==
      "We are a team of driven professionals redefining what's possible in insurance sales. Our mission is to empower agents with world-class training, cutting-edge tools, and the support needed to build a thriving career from anywhere."
      ? theme.about_content
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
      : FALLBACK_PARAGRAPHS;

  return (
    <section id="about" className="surface-base py-20 lg:py-28">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-14">
          <div className="section-eyebrow-row">
            <span className="section-eyebrow-num">06</span>
            <span className="section-eyebrow-line" />
            <span className="section-eyebrow-label">Meet the founder</span>
          </div>
          <h2
            className="text-display-2xl text-[var(--landing-deep-green)] mb-6"
            style={{ fontWeight: 300 }}
          >
            Built by a producer
            <br />
            who got tired of bad software.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Photo — col-span-5 */}
          <div className="lg:col-span-5">
            <div className="card overflow-hidden aspect-[4/5] relative">
              {photoUrl ? (
                <>
                  <img
                    src={photoUrl}
                    alt={theme.about_headline || FOUNDER_NAME}
                    className="w-full h-full object-cover"
                  />
                  {/* adventure-yellow decorative shape bottom-right */}
                  <div
                    className="absolute bottom-0 right-0 pointer-events-none"
                    style={{
                      width: "33%",
                      height: "25%",
                      background: "var(--landing-adventure-yellow)",
                      mixBlendMode: "multiply",
                      opacity: 0.85,
                    }}
                  />
                </>
              ) : (
                <PhotoPlaceholder name={FOUNDER_NAME} />
              )}
            </div>

            {/* Photo caption strip — mono name + title */}
            <div className="card border-t-0 p-5 flex items-center justify-between">
              <div>
                <p className="text-eyebrow mb-0.5">{FOUNDER_TITLE}</p>
                <h3
                  className="text-display-xl text-[var(--landing-deep-green)]"
                  style={{ fontWeight: 700 }}
                >
                  {FOUNDER_NAME}
                </h3>
              </div>
              <span className="badge badge-accent">Recruiting Now</span>
            </div>
          </div>

          {/* Content — col-span-7 */}
          <div className="lg:col-span-7 lg:py-4">
            <div className="space-y-5 text-fluid-base text-[var(--landing-deep-green)]">
              {content.map((paragraph, index) => (
                <p key={index} className="leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Credentials lattice */}
            <div
              className="mt-10 grid grid-cols-2 sm:grid-cols-3"
              style={{ gap: "1px", background: "var(--landing-border)" }}
            >
              <div className="surface-base p-5">
                <p className="text-eyebrow mb-1">Stack</p>
                <p className="text-sm text-[var(--landing-deep-green)] leading-snug font-medium">
                  Claude · Retell · Close · Stripe · Supabase
                </p>
              </div>
              <div className="surface-base p-5">
                <p className="text-eyebrow mb-1">Built where</p>
                <p className="text-sm text-[var(--landing-deep-green)] leading-snug font-medium">
                  In-house, on weekends, by an agent who writes business
                </p>
              </div>
              <div className="surface-base p-5">
                <p className="text-eyebrow mb-1">Sold</p>
                <p className="text-sm text-[var(--landing-deep-green)] leading-snug font-medium">
                  Never · Internal-only software, not for license
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full h-full surface-dark flex items-center justify-center relative overflow-hidden">
      <div
        className="floating-shape"
        style={{
          width: 280,
          height: 280,
          top: "-60px",
          right: "-60px",
          background:
            "radial-gradient(circle, rgba(226,255,204,0.25), transparent 65%)",
          borderRadius: "50%",
        }}
      />
      <div className="text-center relative z-10">
        <div className="w-20 h-20 mx-auto mb-4 border border-[var(--landing-icy-blue)]/30 rounded-[2px] flex items-center justify-center">
          <User
            size={32}
            strokeWidth={1.25}
            className="text-[var(--landing-icy-blue)]/60"
          />
        </div>
        <div
          className="text-display-2xl text-[var(--landing-adventure-yellow)] mb-2"
          style={{ fontWeight: 900 }}
        >
          {initials}
        </div>
        <p className="text-eyebrow !text-[var(--landing-icy-blue)]/50">
          Drop a photo URL in admin → Landing Page Settings → About → Image URL
        </p>
      </div>
    </div>
  );
}
