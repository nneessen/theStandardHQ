import { CheckCircle2 } from "lucide-react";

type Badge = { label: string };
type Props = { badges: Badge[]; className?: string };

export function TrustBadgeRow({ badges, className = "" }: Props) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {badges.map((b) => (
        <span key={b.label} className="landing-badge-pill">
          <CheckCircle2
            size={14}
            strokeWidth={2.25}
            className="text-[var(--landing-gold-deep)]"
          />
          {b.label}
        </span>
      ))}
    </div>
  );
}
