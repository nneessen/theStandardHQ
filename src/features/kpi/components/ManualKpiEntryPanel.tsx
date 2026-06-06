// src/features/kpi/components/ManualKpiEntryPanel.tsx
// Form to upsert one kpi_daily_call_metrics row for a chosen date.
// Prefills from the existing row for that date so the upsert edits in place.

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getTodayString } from "@/lib/date";
import {
  useDailyMetrics,
  useUpsertDailyMetrics,
  type DailyMetricUpsertInput,
} from "../hooks";

// Integer count fields. `required` columns are NOT NULL with a DB default of 0,
// so a blank input is stored as 0; nullable columns are stored as null.
const COUNT_FIELDS = [
  { key: "total_inbound_calls", label: "Inbound Calls", required: true },
  { key: "answered_calls", label: "Answered", required: false },
  { key: "missed_calls", label: "Missed", required: false },
  { key: "leads_received", label: "Leads Received", required: false },
  { key: "clients_sold", label: "Clients Sold", required: true },
  { key: "policies_sold", label: "Policies Sold", required: true },
] as const;

const CURRENCY_FIELDS = [
  { key: "premium_written", label: "Premium Written" },
  { key: "lead_spend", label: "Lead Spend" },
  { key: "marketing_spend", label: "Marketing Spend" },
] as const;

type CountKey = (typeof COUNT_FIELDS)[number]["key"];
type CurrencyKey = (typeof CURRENCY_FIELDS)[number]["key"];

type FormState = Record<CountKey | CurrencyKey, string> & {
  talkMinutes: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  total_inbound_calls: "",
  answered_calls: "",
  missed_calls: "",
  leads_received: "",
  clients_sold: "",
  policies_sold: "",
  premium_written: "",
  lead_spend: "",
  marketing_spend: "",
  talkMinutes: "",
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
      answered_calls: str(row.answered_calls),
      missed_calls: str(row.missed_calls),
      leads_received: str(row.leads_received),
      clients_sold: str(row.clients_sold),
      policies_sold: str(row.policies_sold),
      premium_written: str(row.premium_written),
      lead_spend: str(row.lead_spend),
      marketing_spend: str(row.marketing_spend),
      talkMinutes:
        row.total_talk_time_seconds == null
          ? ""
          : String(Math.round((row.total_talk_time_seconds / 60) * 100) / 100),
      notes: row.notes ?? "",
    });
  }, [existingRows, date]);

  const setField = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const talk = toNumberOrNull(form.talkMinutes);
    const payload: DailyMetricUpsertInput = {
      metric_date: date,
      // NOT-NULL count columns default to 0 when blank.
      total_inbound_calls: toNumberOrNull(form.total_inbound_calls) ?? 0,
      clients_sold: toNumberOrNull(form.clients_sold) ?? 0,
      policies_sold: toNumberOrNull(form.policies_sold) ?? 0,
      // Nullable columns: explicit null clears a previously-saved value.
      answered_calls: toNumberOrNull(form.answered_calls),
      missed_calls: toNumberOrNull(form.missed_calls),
      leads_received: toNumberOrNull(form.leads_received),
      premium_written: toNumberOrNull(form.premium_written),
      lead_spend: toNumberOrNull(form.lead_spend),
      marketing_spend: toNumberOrNull(form.marketing_spend),
      total_talk_time_seconds: talk == null ? null : Math.round(talk * 60),
      notes: form.notes.trim() === "" ? null : form.notes.trim(),
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
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

        <div>
          <Label className="text-[10px]">Talk Time (min)</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            className="h-7 text-[11px]"
            value={form.talkMinutes}
            onChange={(e) => setField("talkMinutes", e.target.value)}
            placeholder="—"
          />
        </div>

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
