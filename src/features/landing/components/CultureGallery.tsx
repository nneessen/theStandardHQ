import { ImageIcon } from "lucide-react";
import type { LandingPageTheme } from "../types";
import { useReveal } from "../hooks/useReveal";

interface Props {
  theme: LandingPageTheme;
}

const PLACEHOLDER_COUNT = 6;

export function CultureGallery({ theme }: Props) {
  const ref = useReveal<HTMLDivElement>();

  const images = theme.gallery_images || [];
  const featured = theme.gallery_featured_url || images[0]?.url;
  const rest = theme.gallery_featured_url ? images : images.slice(1);

  // Always render — show placeholders if no images so user knows where to upload
  const hasContent = images.length > 0 || !!featured;

  return (
    <section id="culture" className="surface-paper py-20 lg:py-28">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-14">
          <div className="section-eyebrow-row">
            <span className="section-eyebrow-num">07</span>
            <span className="section-eyebrow-line" />
            <span className="section-eyebrow-label">Culture</span>
          </div>
          <h2
            className="text-display-2xl text-[var(--landing-deep-green)] mb-4"
            style={{ fontWeight: 300 }}
          >
            {theme.gallery_headline || "The team behind the platform."}
          </h2>
          {theme.gallery_subheadline && (
            <p className="text-fluid-lg text-muted max-w-2xl">
              {theme.gallery_subheadline}
            </p>
          )}
        </div>

        {hasContent ? (
          <div
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4"
            style={{ gap: "1px", background: "var(--landing-border)" }}
          >
            {/* Featured image — spans 2x2 on desktop */}
            {featured && (
              <div className="md:col-span-2 lg:col-span-2 lg:row-span-2 relative aspect-square lg:aspect-auto bg-[var(--landing-icy-blue)] overflow-hidden">
                <img
                  src={featured}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute bottom-0 right-0 pointer-events-none"
                  style={{
                    width: "20%",
                    height: "30%",
                    background: "var(--landing-adventure-yellow)",
                    mixBlendMode: "multiply",
                    opacity: 0.7,
                  }}
                />
              </div>
            )}

            {rest.slice(0, 6).map((img, idx) => (
              <div
                key={`${img.url}-${idx}`}
                className="group relative bg-[var(--landing-icy-blue)] aspect-square overflow-hidden"
              >
                <img
                  src={img.url}
                  alt={img.alt || img.caption || ""}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {img.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--landing-deep-green)]/90 via-[var(--landing-deep-green)]/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-eyebrow !text-[var(--landing-icy-blue)]">
                      {img.caption}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <PlaceholderGrid />
        )}
      </div>
    </section>
  );
}

function PlaceholderGrid() {
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      style={{ gap: "1px", background: "var(--landing-border)" }}
    >
      {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
        <div
          key={i}
          className="aspect-square surface-base flex flex-col items-center justify-center text-center px-4"
        >
          <ImageIcon
            size={28}
            strokeWidth={1.25}
            className="text-[var(--landing-terrain-grey)] mb-3"
          />
          <p className="text-eyebrow">{`Photo ${i + 1}`}</p>
          <p className="text-[10px] text-muted mt-2 leading-snug max-w-[18ch]">
            Upload via admin → Landing Page Settings → Gallery
          </p>
        </div>
      ))}
    </div>
  );
}
