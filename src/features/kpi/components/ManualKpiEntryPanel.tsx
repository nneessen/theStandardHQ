// src/features/kpi/components/ManualKpiEntryPanel.tsx
// Form to upsert one kpi_daily_call_metrics row for a chosen date.
// Prefills from the existing row for that date so the upsert edits in place.
//
// Inbound model: every inbound call is answered and costs a flat
// COST_PER_INBOUND_CALL, so the form only collects the numbers an agent actually
// controls (calls, clients, policies, premium). Call spend is auto-derived and
// shown read-only — never entered or stored. Retired fields (answered, missed,
// leads received, lead/marketing spend, talk time) are written null on save so
// re-saving a day clears any legacy value.

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getTodayString } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { COST_PER_INBOUND_CALL } from "@/constants/financial";
import {
  useDailyMetrics,
  useUpsertDailyMetrics,
  type DailyMetricUpsertInput,
} from "../hooks";

// Integer count fields. `required` columns are NOT NULL with a DB default of 0,
// so a blank input is stored as 0.
const COUNT_FIELDS = [
  { key: "total_inbound_calls", label: "Inbound Calls", required: true },
  { key: "clients_sold", label: "Clients Sold", required: true },
  { key: "policies_sold", label: "Policies Sold", required: true },
] as const;

const CURRENCY_FIELDS = [
  { key: "premium_written", label: "Premium Written" },
] as const;

type CountKey = (typeof COUNT_FIELDS)[number]["key"];
type CurrencyKey = (typeof CURRENCY_FIELDS)[number]["key"];

type FormState = Record<CountKey | CurrencyKey, string> & {
  notes: string;
};

const EMPTY_FORM: FormState = {
  total_inbound_calls: "",
  clients_sold: "",
  policies_sold: "",
  premium_written: "",
  notes: "",
};

/** Parse a string field to a number, or null when blank/invalid. */
function toNumberOrNull(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const ManualKpiEntryPanel: React.FC = () => {
  const [date, setDate] = useState<string>(getTodayString());
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Prefill from the existing row for the selected date (single-day range).
  const { data: existingRows } = useDailyMetrics({ from: date, to: date });
  const upsert = useUpsertDailyMetrics();

  useEffect(() => {
    const row = existingRows?.find((r) => r.metric_date === date);
    if (!row) {
      setForm(EMPTY_FORM);
      return;
    }
    const str = (n: number | null) => (n == null ? "" : String(n));
    setForm({
      total_inbound_calls: str(row.total_inbound_calls),
      clients_sold: str(row.clients_sold),
      policies_sold: str(row.policies_sold),
      premium_written: str(row.premium_written),
      notes: row.notes ?? "",
    });
  }, [existingRows, date]);

  const setField = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Auto-derived inbound call spend (calls × flat per-call cost). Display-only.
  const inboundCalls = toNumberOrNull(form.total_inbound_calls) ?? 0;
  const estimatedSpend = inboundCalls * COST_PER_INBOUND_CALL;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: DailyMetricUpsertInput = {
      metric_date: date,
      // NOT-NULL count columns default to 0 when blank.
      total_inbound_calls: toNumberOrNull(form.total_inbound_calls) ?? 0,
      clients_sold: toNumberOrNull(form.clients_sold) ?? 0,
      policies_sold: toNumberOrNull(form.policies_sold) ?? 0,
      premium_written: toNumberOrNull(form.premium_written),
      notes: form.notes.trim() === "" ? null : form.notes.trim(),
      // Retired fields: written null so a re-save clears any legacy value. Cost is
      // computed (calls × COST_PER_INBOUND_CALL), never stored; every call is
      // answered, so answered/missed/leads are not tracked.
      answered_calls: null,
      missed_calls: null,
      leads_received: null,
      lead_spend: null,
      marketing_spend: null,
      total_talk_time_seconds: null,
    };
    upsert.mutate(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-border bg-card p-3 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground">
          Log daily metrics
        </h3>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="kpi-metric-date" className="text-[10px]">
            Date
          </Label>
          <Input
            id="kpi-metric-date"
            type="date"
            className="h-7 w-[140px] text-[11px]"
            value={date}
            max={getTodayString()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COUNT_FIELDS.map((f) => (
          <div key={f.key}>
            <Label className="text-[10px]">{f.label}</Label>
            <Input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              className="h-7 text-[11px]"
              value={form[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.required ? "0" : "—"}
            />
          </div>
        ))}

        {CURRENCY_FIELDS.map((f) => (
          <div key={f.key}>
            <Label className="text-[10px]">{f.label} ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="h-7 text-[11px]"
              value={form[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder="—"
            />
          </div>
        ))}
      </div>

      {/* Auto-computed call spend — flat per-call cost × inbound calls. Read-only. */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          Estimated call spend ({formatCurrency(COST_PER_INBOUND_CALL)} ×{" "}
          {inboundCalls} call{inboundCalls === 1 ? "" : "s"})
        </span>
        <span className="text-[11px] font-semibold text-foreground">
          {formatCurrency(estimatedSpend)}
        </span>
      </div>

      <div>
        <Label className="text-[10px]">Notes</Label>
        <Textarea
          className="min-h-[48px] text-[11px]"
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          placeholder="Optional context for the day…"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          className="h-7 text-[11px]"
          disabled={upsert.isPending}
        >
          {upsert.isPending ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Saving
            </>
          ) : (
            "Save day"
          )}
        </Button>
      </div>
    </form>
  );
};
