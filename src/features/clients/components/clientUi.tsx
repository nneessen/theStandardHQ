// src/features/clients/components/clientUi.tsx
// Small on-brand presentational helpers shared by the Clients list + detail pages.
// Mirrors the tinted-status / panel vocabulary used by the Policies page and inbound intake.

export const tint = (v: string, pct: number) =>
  `color-mix(in srgb, var(${v}) ${pct}%, transparent)`;

/** status (policy lifecycle or call status) -> accent CSS var. */
export function statusVar(s?: string | null): string {
  const k = (s ?? "").toLowerCase();
  if (k === "active") return "--green";
  if (k === "pending" || k === "ringing" || k === "lead") return "--amber";
  if (k === "lapsed" || k === "cancelled" || k === "inactive" || k === "ended")
    return "--red";
  return "--blue";
}

export function StatusBadge({ status }: { status?: string | null }) {
  const v = statusVar(status);
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
      style={{
        background: tint(v, 16),
        color: `var(${v})`,
        border: `1px solid ${tint(v, 30)}`,
      }}
    >
      {status ?? "—"}
    </span>
  );
}

export function Panel({
  title,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border border-v2-ring bg-v2-card shadow-board-panel ${className}`}
    >
      <div className="border-b border-v2-ring px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-v2-accent">
        {title}
      </div>
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/** null-safe currency for premium columns. */
export const money = (n?: number | null) =>
  n == null ? "—" : `$${Number(n).toLocaleString()}`;
