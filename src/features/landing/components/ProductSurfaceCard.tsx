import type { ReactNode } from "react";

type Pin = { x: string; y: string; label: string };

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  reverse?: boolean;
  pins?: Pin[];
  children: ReactNode;
}

export function ProductSurfaceCard({
  eyebrow,
  title,
  description,
  reverse,
  pins,
  children,
}: Props) {
  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reverse ? "lg:[direction:rtl]" : ""}`}
    >
      <div className="lg:[direction:ltr]">
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h3 className="font-display text-3xl lg:text-4xl mb-4">{title}</h3>
        <p className="text-base text-[var(--landing-slate)] leading-relaxed">
          {description}
        </p>
      </div>
      <div className="lg:[direction:ltr] relative">
        <div className="landing-card p-4 bg-[var(--landing-navy)] overflow-hidden">
          {children}
        </div>
        {pins?.map((pin, i) => (
          <div key={i} className="absolute" style={{ left: pin.x, top: pin.y }}>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--landing-gold)] ring-4 ring-[var(--landing-gold)]/30 animate-pulse" />
              <span className="text-xs font-medium bg-[var(--landing-warm-white)] border border-[var(--landing-border)] px-2 py-1 rounded shadow-sm whitespace-nowrap">
                {pin.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* In-card mock screen primitives. Pure JSX so we don't need real screenshots. */

export function MockDashboard() {
  return (
    <div className="rounded bg-[#0b0d12] text-white p-4 space-y-3 font-mono text-[11px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-white/60">Dashboard</span>
        <span className="text-[var(--landing-gold)]">May 1</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded bg-white/[0.04] p-3">
          <div className="text-white/50 text-[10px] uppercase tracking-wider">
            Pace
          </div>
          <div className="text-2xl font-semibold mt-1">73%</div>
        </div>
        <div className="rounded bg-white/[0.04] p-3">
          <div className="text-white/50 text-[10px] uppercase tracking-wider">
            Commission
          </div>
          <div className="text-2xl font-semibold mt-1">$8,420</div>
        </div>
        <div className="rounded bg-white/[0.04] p-3">
          <div className="text-white/50 text-[10px] uppercase tracking-wider">
            Apps MTD
          </div>
          <div className="text-2xl font-semibold mt-1">14</div>
        </div>
      </div>
      <div className="rounded bg-white/[0.04] p-3">
        <div className="text-white/50 text-[10px] uppercase tracking-wider mb-2">
          Leaderboard
        </div>
        <div className="space-y-1.5">
          {[
            { n: "Maria L.", v: "$12,400" },
            { n: "James K.", v: "$10,100" },
            { n: "You", v: "$8,420" },
          ].map((r, i) => (
            <div key={i} className="flex justify-between text-white/80">
              <span>
                {i + 1}. {r.n}
              </span>
              <span className="text-[var(--landing-gold)]">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MockLeadHeat() {
  return (
    <div className="rounded bg-[#0b0d12] text-white p-4 space-y-2 font-mono text-[11px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-white/60">AI Hot 100</span>
        <span className="text-[var(--landing-gold)]">live</span>
      </div>
      {[
        { n: "Carlos R.", s: 94, t: "called 2d ago" },
        { n: "Rebecca M.", s: 91, t: "viewed quote 4h ago" },
        { n: "Tony N.", s: 88, t: "opened email 1h ago" },
        { n: "Tasha K.", s: 84, t: "callback requested" },
        { n: "Jordan A.", s: 79, t: "renewal in 30d" },
      ].map((row, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded bg-white/[0.04] p-2"
        >
          <span className="text-[var(--landing-gold)] font-semibold w-8">
            {row.s}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-white/90">{row.n}</div>
            <div className="text-white/50 text-[10px]">{row.t}</div>
          </div>
          <span className="text-white/40 text-[10px]">→</span>
        </div>
      ))}
    </div>
  );
}

export function MockUWWizard() {
  return (
    <div className="rounded bg-[#0b0d12] text-white p-4 space-y-3 font-mono text-[11px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-white/60">Underwriting Wizard · Step 4 of 6</span>
        <span className="text-[var(--landing-gold)]">75%</span>
      </div>
      <div className="space-y-2">
        <div className="text-white/80">Health intake</div>
        {[
          { q: "Tobacco use", a: "No" },
          { q: "Diabetes", a: "Type 2, controlled" },
          { q: "Cardiac history", a: "None" },
          { q: "Height / Weight", a: "5'10\" · 220 lbs" },
        ].map((r, i) => (
          <div
            key={i}
            className="flex justify-between rounded bg-white/[0.04] p-2"
          >
            <span className="text-white/60">{r.q}</span>
            <span className="text-white/90">{r.a}</span>
          </div>
        ))}
      </div>
      <div className="rounded border border-[var(--landing-gold)]/40 bg-[var(--landing-gold)]/[0.06] p-3">
        <div className="text-[var(--landing-gold)] uppercase tracking-wider text-[10px]">
          Predicted tier
        </div>
        <div className="text-base mt-1">
          Standard Plus · F&G most likely approval
        </div>
      </div>
    </div>
  );
}

export function MockRecruiting() {
  return (
    <div className="rounded bg-[#0b0d12] text-white p-4 space-y-2 font-mono text-[11px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-white/60">Recruiting Pipeline</span>
        <span className="text-[var(--landing-gold)]">12 active</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        {[
          { stage: "Apply", count: 5, who: ["A. Diaz", "M. Chu"] },
          { stage: "Train", count: 4, who: ["S. Park", "J. West"] },
          { stage: "License", count: 3, who: ["K. Lee", "R. Cole"] },
        ].map((col) => (
          <div key={col.stage} className="rounded bg-white/[0.04] p-2">
            <div className="flex justify-between text-white/60 mb-2">
              <span>{col.stage}</span>
              <span>{col.count}</span>
            </div>
            <div className="space-y-1.5">
              {col.who.map((w, i) => (
                <div
                  key={i}
                  className="rounded bg-white/[0.06] px-2 py-1.5 text-white/90"
                >
                  {w}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded border border-[var(--landing-gold)]/40 bg-[var(--landing-gold)]/[0.06] p-2 text-[10px]">
        <span className="text-[var(--landing-gold)]">✓</span>{" "}
        <span className="text-white/80">
          Phase advance triggered Slack notification + welcome email
        </span>
      </div>
    </div>
  );
}
