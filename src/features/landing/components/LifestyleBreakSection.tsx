interface Props {
  imageUrl?: string | null;
  overlayText?: string;
  overlaySubtext?: string;
  variant?: "image" | "navy-gradient";
}

export function LifestyleBreakSection({
  imageUrl,
  overlayText,
  overlaySubtext,
  variant = "image",
}: Props) {
  const isImage = variant === "image" && !!imageUrl;

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[400px] lg:h-[500px]">
        {isImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-navy-gradient">
            {/* Decorative gold elements */}
            <div
              className="gold-orb"
              style={{
                width: 480,
                height: 480,
                top: "-120px",
                right: "-120px",
              }}
            />
            <div
              className="gold-orb"
              style={{ width: 320, height: 320, bottom: "-80px", left: "10%" }}
            />
            <div
              className="gold-ring"
              style={{ width: 600, height: 600, top: "20%", left: "60%" }}
            />
            <div
              className="gold-ring"
              style={{ width: 380, height: 380, top: "30%", left: "65%" }}
            />
          </div>
        )}

        {/* Dark overlay for text readability */}
        {(overlayText || overlaySubtext) && isImage && (
          <div className="absolute inset-0 bg-[var(--landing-navy)]/55" />
        )}

        {/* Top gradient fade */}
        <div className="absolute top-0 inset-x-0 h-24 lg:h-32 lifestyle-fade-top pointer-events-none" />
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 inset-x-0 h-24 lg:h-32 lifestyle-fade-bottom pointer-events-none" />

        {(overlayText || overlaySubtext) && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="text-center max-w-3xl">
              {overlayText && (
                <h3 className="font-display text-3xl sm:text-4xl lg:text-6xl text-[var(--landing-cream)] mb-5 leading-[1.05]">
                  {overlayText}
                </h3>
              )}
              {overlaySubtext && (
                <p className="text-lg lg:text-xl text-[var(--landing-cream)]/85 leading-relaxed">
                  {overlaySubtext}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
