// src/features/workflows/components/EventTriggerPicker.tsx
//
// Rebuilt "Select Event Trigger" picker (replaces EventSelectionDialog). Two-pane
// modal: a real category rail + a big searchable, grouped, readable event list with
// explicit selection and a confirm footer. Drives off the same eventTypes the
// wizard already loads (useTriggerEventTypes — DB-backed, IMO-scoped, respects the
// admin toggles); display-only concerns (variable type colors, POPULAR, category
// accent/icon) come from event-picker-meta. Styled on the .theme-v2 "Board" tokens.

import { useEffect, useMemo, useState } from "react";
import { Search, Zap, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TriggerEventType } from "@/types/workflow.types";
import {
  categoryMeta,
  categoryOrder,
  variableType,
  splitVars,
  VAR_TYPE_ACCENT,
  POPULAR_EVENTS,
} from "../event-picker-meta";

interface EventTriggerPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTypes: TriggerEventType[];
  selectedEvent?: string;
  onSelectEvent: (eventName: string) => void;
}

const tint = (accentVar: string, pct: number) =>
  `color-mix(in srgb, var(${accentVar}) ${pct}%, transparent)`;

/** Normalize availableVariables (array of names, or legacy object) to a name list. */
function toVarNames(raw: TriggerEventType["availableVariables"]): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (raw && typeof raw === "object") return Object.keys(raw);
  return [];
}

export default function EventTriggerPicker({
  open,
  onOpenChange,
  eventTypes,
  selectedEvent,
  onSelectEvent,
}: EventTriggerPickerProps) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [localSel, setLocalSel] = useState<string | undefined>(selectedEvent);

  // Reset local state each time the picker opens (cancel/esc must preserve the
  // wizard's prior event, so we only commit on "Use this trigger").
  useEffect(() => {
    if (open) {
      setLocalSel(selectedEvent);
      setQuery("");
      setActiveCat("all");
    }
  }, [open, selectedEvent]);

  // Per-category counts (full set, for the rail).
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of eventTypes)
      m[e.category || "other"] = (m[e.category || "other"] || 0) + 1;
    return m;
  }, [eventTypes]);

  const railCats = useMemo(
    () =>
      [...new Set(eventTypes.map((e) => e.category || "other"))].sort(
        (a, b) => categoryOrder(a) - categoryOrder(b),
      ),
    [eventTypes],
  );

  // Search (id / description / category label) + category filter.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return eventTypes.filter((e) => {
      const cat = e.category || "other";
      if (activeCat !== "all" && cat !== activeCat) return false;
      if (!q) return true;
      return (
        e.eventName.toLowerCase().includes(q) ||
        (e.description?.toLowerCase() || "").includes(q) ||
        categoryMeta(cat).label.toLowerCase().includes(q)
      );
    });
  }, [eventTypes, query, activeCat]);

  // Group filtered events by category, in rail order.
  const groups = useMemo(() => {
    const m: Record<string, TriggerEventType[]> = {};
    for (const e of filtered) (m[e.category || "other"] ||= []).push(e);
    return Object.entries(m).sort(
      ([a], [b]) => categoryOrder(a) - categoryOrder(b),
    );
  }, [filtered]);

  const confirm = () => {
    if (!localSel) return;
    onSelectEvent(localSel);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="block gap-0 border-0 p-0 shadow-none sm:max-w-none"
        style={{
          width: 1080,
          maxWidth: "95vw",
          height: "82vh",
          maxHeight: 820,
          borderRadius: 20,
          background: "var(--surface-2)",
          border: "1px solid var(--line2)",
          boxShadow: "var(--panelshadow)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Head ─────────────────────────────────────────────────────────── */}
        <div
          className="shrink-0 px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: tint("--violet", 14),
                color: "var(--violet)",
              }}
            >
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle
                className="font-display text-[19px] font-extrabold uppercase tracking-wide"
                style={{ color: "var(--ink)" }}
              >
                Select Event Trigger
              </DialogTitle>
              <DialogDescription
                className="font-sans text-[13.5px]"
                style={{ color: "var(--mut)" }}
              >
                Pick the event that fires this workflow automatically.
              </DialogDescription>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--mut2)" }}
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events by name or description…"
              className="h-[50px] w-full rounded-xl pl-11 pr-16 font-sans text-[14px] outline-none transition-shadow placeholder:text-[var(--mut2)]"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--line2)",
                color: "var(--ink)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.boxShadow =
                  "0 0 0 3px " + tint("--violet", 35))
              }
              onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            />
            <kbd
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{
                background: "var(--surface-3)",
                color: "var(--mut2)",
                border: "1px solid var(--line)",
              }}
            >
              esc
            </kbd>
          </div>
        </div>

        {/* ── Body: rail + list ────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1">
          {/* Left rail */}
          <div
            className="w-[228px] shrink-0 overflow-y-auto px-3 py-4"
            style={{ borderRight: "1px solid var(--line)" }}
          >
            <p
              className="mb-2 px-2 font-mono text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--mut2)" }}
            >
              Categories
            </p>
            <RailRow
              label="All Events"
              count={eventTypes.length}
              accent="--violet"
              active={activeCat === "all"}
              onClick={() => setActiveCat("all")}
              icon={<Zap className="h-4 w-4" />}
            />
            {railCats.map((cat) => {
              const meta = categoryMeta(cat);
              const Icon = meta.icon;
              return (
                <RailRow
                  key={cat}
                  label={meta.label}
                  count={counts[cat] || 0}
                  accent={meta.accent}
                  active={activeCat === cat}
                  onClick={() => setActiveCat(cat)}
                  icon={<Icon className="h-4 w-4" />}
                />
              );
            })}
          </div>

          {/* Right list */}
          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
            {groups.length === 0 ? (
              <div
                className="flex h-full flex-col items-center justify-center gap-2 text-center"
                style={{ color: "var(--mut2)" }}
              >
                <Search className="h-7 w-7 opacity-50" />
                <p className="font-sans text-[14px]">
                  No events match “{query}”.
                </p>
              </div>
            ) : (
              groups.map(([cat, events]) => {
                const meta = categoryMeta(cat);
                return (
                  <div key={cat} className="mb-5 last:mb-0">
                    <p
                      className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest"
                      style={{ color: `var(${meta.accent})` }}
                    >
                      {meta.label}{" "}
                      <span style={{ color: "var(--mut2)" }}>
                        ({events.length})
                      </span>
                    </p>
                    <div className="space-y-2">
                      {events.map((e) => (
                        <EventCard
                          key={e.id || e.eventName}
                          event={e}
                          selected={localSel === e.eventName}
                          onSelect={() => setLocalSel(e.eventName)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Foot ─────────────────────────────────────────────────────────── */}
        <div
          className="flex shrink-0 items-center justify-between px-6 py-4"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <div className="flex items-center gap-2 font-sans text-[13px]">
            {localSel ? (
              <>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: "var(--violet)" }}
                />
                <span style={{ color: "var(--mut)" }}>Selected</span>
                <span
                  className="font-mono text-[13px]"
                  style={{ color: "var(--cream)" }}
                >
                  {localSel}
                </span>
              </>
            ) : (
              <span style={{ color: "var(--mut2)" }}>
                Select an event to continue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-lg px-4 font-sans text-[13px] font-semibold transition-colors hover:bg-[var(--surface-3)]"
              style={{ color: "var(--mut)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!localSel}
              className="h-9 rounded-lg px-4 font-sans text-[13px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "var(--blue)", color: "#0c1322" }}
            >
              Use this trigger
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Rail row ─────────────────────────────────────────────────────────────── */
function RailRow({
  label,
  count,
  accent,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  accent: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors"
      style={{
        background: active ? tint(accent, 12) : "transparent",
        boxShadow: active ? `inset 0 0 0 1px ${tint(accent, 40)}` : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--surface-3)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg"
        style={{ background: tint(accent, 14), color: `var(${accent})` }}
      >
        {icon}
      </span>
      <span
        className="flex-1 truncate font-sans text-[13.5px] font-semibold"
        style={{ color: active ? "var(--ink)" : "var(--mut)" }}
      >
        {label}
      </span>
      <span className="font-mono text-[12px]" style={{ color: "var(--mut2)" }}>
        {count}
      </span>
    </button>
  );
}

/* ── Event card ───────────────────────────────────────────────────────────── */
function EventCard({
  event,
  selected,
  onSelect,
}: {
  event: TriggerEventType;
  selected: boolean;
  onSelect: () => void;
}) {
  const { specific, sharedCount } = splitVars(
    toVarNames(event.availableVariables),
  );
  const popular = POPULAR_EVENTS.has(event.eventName);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full gap-3 rounded-xl p-3.5 text-left transition-colors"
      style={{
        background: selected ? tint("--violet", 9) : "var(--surface-1)",
        border: selected ? "1px solid var(--violet)" : "1px solid var(--line)",
        boxShadow: selected ? `0 0 0 3px ${tint("--violet", 16)}` : "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "var(--surface-3)";
          e.currentTarget.style.borderColor = "var(--line2)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "var(--surface-1)";
          e.currentTarget.style.borderColor = "var(--line)";
        }
      }}
    >
      {/* radio */}
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{
          border: selected
            ? "1px solid var(--violet)"
            : "1px solid var(--line3)",
          background: selected ? "var(--violet)" : "transparent",
        }}
      >
        {selected && <Check className="h-3 w-3" style={{ color: "#1a1430" }} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono text-[16.5px] font-bold"
            style={{ color: "var(--cream)" }}
          >
            {event.eventName}
          </span>
          {popular && (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide"
              style={{ background: tint("--amber", 16), color: "var(--amber)" }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              Popular
            </span>
          )}
        </div>
        {event.description && (
          <p
            className="mt-1 font-sans text-[14px] leading-snug"
            style={{ color: "var(--mut)" }}
          >
            {event.description}
          </p>
        )}
        {(specific.length > 0 || sharedCount > 0) && (
          <div className="mt-2.5">
            <p
              className="mb-1.5 font-mono text-[9.5px] font-bold uppercase tracking-widest"
              style={{ color: "var(--mut2)" }}
            >
              Available Variables
            </p>
            <div className="flex flex-wrap gap-1.5">
              {specific.map((v) => {
                const t = variableType(v);
                const accent = VAR_TYPE_ACCENT[t];
                return (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 rounded-md py-0.5 pl-1.5 pr-1"
                    style={{
                      background: "var(--surface-3)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: "var(--ink)" }}
                    >
                      {v}
                    </span>
                    <span
                      className="rounded px-1 font-mono text-[9px] font-bold uppercase"
                      style={{
                        background: tint(accent, 16),
                        color: `var(${accent})`,
                      }}
                    >
                      {t}
                    </span>
                  </span>
                );
              })}
              {sharedCount > 0 && (
                <span
                  title="Shared workflow/user/date variables available on every event — insert them on the email step."
                  className="inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px]"
                  style={{
                    background: "var(--surface-3)",
                    border: "1px dashed var(--line2)",
                    color: "var(--mut)",
                  }}
                >
                  +{sharedCount} shared
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
