import { type ReactNode, cloneElement, isValidElement } from "react";

const ACCENT = "#6366f1";

export function BuilderSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  // Clone the icon to apply accent color styling
  const styledIcon = isValidElement<{
    className?: string;
    style?: React.CSSProperties;
  }>(icon)
    ? cloneElement(icon, { style: { color: ACCENT } })
    : icon;

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      {/* ── Header ── */}
      <div className="relative overflow-hidden border-b border-border/60 px-4 py-3">
        {/* Subtle gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${ACCENT}06 0%, transparent 60%)`,
          }}
        />
        <div className="relative flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
            style={{ backgroundColor: `${ACCENT}12` }}
          >
            {styledIcon}
          </div>
          <div className="min-w-0">
            <h3
              className="text-[13px] font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {title}
            </h3>
            <p className="text-[10px] leading-4 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>
      {/* ── Content ── */}
      <div className="p-4">{children}</div>
    </section>
  );
}
