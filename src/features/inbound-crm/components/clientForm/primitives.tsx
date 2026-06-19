// src/features/inbound-crm/components/clientForm/primitives.tsx
// Shared, on-brand (theme-v2 / "The Board") field + layout primitives for the client intake form.
// Extracted from InboundCallModal so the modal and the Clients detail page render identical fields.
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export const tint = (v: string, pct: number) =>
  `color-mix(in srgb, var(${v}) ${pct}%, transparent)`;

// status -> accent CSS var (mirrors the Policies-page tinted badges)
export function statusVar(s?: string | null): string {
  const k = (s ?? "").toLowerCase();
  if (k === "active") return "--green";
  if (k === "pending" || k === "ringing") return "--amber";
  if (k === "lapsed" || k === "cancelled" || k === "ended") return "--red";
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

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-v2-ink-muted">
      {children}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  className,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm"
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 self-end pb-1.5 text-sm text-v2-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--blue)]"
      />
      {label}
    </label>
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

export function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-v2-ink-muted">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm text-v2-ink">
        {value || "—"}
      </span>
    </div>
  );
}
