import { Link } from "@tanstack/react-router";
import type { LandingPageTheme } from "../types";

interface Props {
  theme: LandingPageTheme;
}

export function LandingFooter({ theme }: Props) {
  const hasSocial =
    theme.social_links && Object.values(theme.social_links).some(Boolean);
  const hasContact =
    theme.contact_email || theme.contact_phone || theme.contact_address;

  return (
    <footer className="section-navy py-16 border-t border-[var(--landing-cream)]/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            {theme.logo_light_url ? (
              <img
                src={theme.logo_light_url}
                alt="The Standard"
                className="h-9 w-auto object-contain mb-5"
              />
            ) : (
              <div className="font-display text-2xl text-[var(--landing-cream)] mb-5">
                The Standard
              </div>
            )}
            <p className="text-sm text-[var(--landing-cream)]/60 max-w-sm leading-relaxed">
              The agency built like a tech company. Recruiting agents who want
              better software, real downline overrides, and a team that ships.
            </p>
          </div>

          {hasContact && (
            <div>
              <h4
                className="eyebrow mb-4"
                style={{ color: "var(--landing-gold)" }}
              >
                Contact
              </h4>
              <div className="space-y-2 text-sm text-[var(--landing-cream)]/70">
                {theme.contact_email && (
                  <a
                    href={`mailto:${theme.contact_email}`}
                    className="block hover:text-[var(--landing-gold)] transition-colors"
                  >
                    {theme.contact_email}
                  </a>
                )}
                {theme.contact_phone && (
                  <a
                    href={`tel:${theme.contact_phone}`}
                    className="block hover:text-[var(--landing-gold)] transition-colors"
                  >
                    {theme.contact_phone}
                  </a>
                )}
                {theme.contact_address && (
                  <span className="block">{theme.contact_address}</span>
                )}
              </div>
            </div>
          )}

          <div>
            <h4
              className="eyebrow mb-4"
              style={{ color: "var(--landing-gold)" }}
            >
              Links
            </h4>
            <div className="space-y-2 text-sm text-[var(--landing-cream)]/70">
              {hasSocial && (
                <>
                  {theme.social_links.instagram && (
                    <a
                      href={theme.social_links.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:text-[var(--landing-gold)] transition-colors"
                    >
                      Instagram
                    </a>
                  )}
                  {theme.social_links.tiktok && (
                    <a
                      href={theme.social_links.tiktok}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:text-[var(--landing-gold)] transition-colors"
                    >
                      TikTok
                    </a>
                  )}
                  {theme.social_links.youtube && (
                    <a
                      href={theme.social_links.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:text-[var(--landing-gold)] transition-colors"
                    >
                      YouTube
                    </a>
                  )}
                  {theme.social_links.facebook && (
                    <a
                      href={theme.social_links.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:text-[var(--landing-gold)] transition-colors"
                    >
                      Facebook
                    </a>
                  )}
                  {theme.social_links.twitter && (
                    <a
                      href={theme.social_links.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:text-[var(--landing-gold)] transition-colors"
                    >
                      Twitter
                    </a>
                  )}
                </>
              )}
              <Link
                to="/terms"
                className="block hover:text-[var(--landing-gold)] transition-colors"
              >
                Terms
              </Link>
              <Link
                to="/privacy"
                className="block hover:text-[var(--landing-gold)] transition-colors"
              >
                Privacy
              </Link>
              <Link
                to="/login"
                className="block hover:text-[var(--landing-gold)] transition-colors"
              >
                Agent Login
              </Link>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[var(--landing-cream)]/10 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--landing-cream)]/40">
            © {new Date().getFullYear()} Nick Neessen. All rights reserved. The
            Standard HQ™ is owned and operated by Nick Neessen.
          </p>
          <p className="text-xs text-[var(--landing-cream)]/30">
            Built in-house. Powered by Claude, Retell, Close, Stripe, and
            Supabase.
          </p>
        </div>
      </div>
    </footer>
  );
}
