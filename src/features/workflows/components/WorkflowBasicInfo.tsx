// src/features/workflows/components/WorkflowBasicInfo.tsx

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { tint } from "../board";
import type {
  WorkflowFormData,
  WorkflowCategory,
} from "@/types/workflow.types";

interface WorkflowBasicInfoProps {
  data: WorkflowFormData;
  onChange: (updates: Partial<WorkflowFormData>) => void;
  errors: Record<string, string>;
}

const WORKFLOW_CATEGORIES = [
  {
    value: "email" as WorkflowCategory,
    label: "Email",
    description: "Email campaigns and communications",
  },
  {
    value: "recruiting" as WorkflowCategory,
    label: "Recruiting",
    description: "Candidate and recruit management",
  },
  {
    value: "commission" as WorkflowCategory,
    label: "Commission",
    description: "Commission tracking and alerts",
  },
  {
    value: "general" as WorkflowCategory,
    label: "General",
    description: "Other automation workflows",
  },
];

const FIELD_BASE: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--line2)",
  borderRadius: 12,
  height: 40,
  padding: "0 14px",
  fontSize: 14,
  color: "var(--ink)",
  width: "100%",
  outline: "none",
  transition: "box-shadow 0.15s, border-color 0.15s",
};

const FIELD_FOCUS_SHADOW = `0 0 0 3px ${tint("--blue", 35)}`;
const FIELD_ERROR_BORDER = "var(--red)";

function FieldLabel({
  children,
  required,
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label
      className="mb-1.5 block font-sans text-[13px] font-semibold"
      style={{ color: "var(--mut)" }}
    >
      {children}
      {required && (
        <span className="ml-0.5" style={{ color: "var(--red)" }}>
          *
        </span>
      )}
      {optional && (
        <span
          className="ml-1.5 font-mono text-[11px] font-normal"
          style={{ color: "var(--mut2)" }}
        >
          optional
        </span>
      )}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 font-sans text-[12px]" style={{ color: "var(--red)" }}>
      {msg}
    </p>
  );
}

export default function WorkflowBasicInfo({
  data,
  onChange,
  errors,
}: WorkflowBasicInfoProps) {
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [catFocused, setCatFocused] = useState(false);

  const priority = data.settings?.priority ?? 50;
  const band = priority < 34 ? "Low" : priority > 66 ? "High" : "Normal";

  return (
    <div className="w-full space-y-5">
      {/* ── Workflow Name ─────────────────────────────────────────────── */}
      <div>
        <FieldLabel required>Workflow Name</FieldLabel>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Welcome Email Series"
          maxLength={100}
          autoComplete="off"
          data-bwignore="true"
          data-1p-ignore="true"
          data-lpignore="true"
          style={{
            ...FIELD_BASE,
            borderColor: errors.name
              ? FIELD_ERROR_BORDER
              : nameFocused
                ? "var(--blue)"
                : "var(--line2)",
            boxShadow: nameFocused ? FIELD_FOCUS_SHADOW : "none",
          }}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
        />
        <FieldError msg={errors.name} />
      </div>

      {/* ── Description ───────────────────────────────────────────────── */}
      <div>
        <FieldLabel optional>Description</FieldLabel>
        <textarea
          value={data.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Briefly describe what this workflow does..."
          rows={3}
          maxLength={500}
          autoComplete="off"
          data-bwignore="true"
          data-1p-ignore="true"
          data-lpignore="true"
          style={{
            ...FIELD_BASE,
            height: "auto",
            padding: "10px 14px",
            resize: "none",
            lineHeight: 1.55,
            borderColor: errors.description
              ? FIELD_ERROR_BORDER
              : descFocused
                ? "var(--blue)"
                : "var(--line2)",
            boxShadow: descFocused ? FIELD_FOCUS_SHADOW : "none",
          }}
          onFocus={() => setDescFocused(true)}
          onBlur={() => setDescFocused(false)}
        />
        <FieldError msg={errors.description} />
      </div>

      {/* ── Category ──────────────────────────────────────────────────── */}
      <div>
        <FieldLabel required>Category</FieldLabel>
        <select
          value={data.category}
          onChange={(e) =>
            onChange({ category: e.target.value as WorkflowCategory })
          }
          style={{
            ...FIELD_BASE,
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 14px center",
            paddingRight: 36,
            borderColor: catFocused ? "var(--blue)" : "var(--line2)",
            boxShadow: catFocused ? FIELD_FOCUS_SHADOW : "none",
          }}
          onFocus={() => setCatFocused(true)}
          onBlur={() => setCatFocused(false)}
        >
          <option value="" disabled>
            Select a category...
          </option>
          {WORKFLOW_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label} — {cat.description}
            </option>
          ))}
        </select>
      </div>

      {/* ── Execution Priority ────────────────────────────────────────── */}
      <div
        style={{
          background: tint("--amber", 7),
          border: `1px solid ${tint("--amber", 22)}`,
          borderRadius: 14,
          padding: 16,
        }}
      >
        {/* Header */}
        <div className="mb-1 flex items-center gap-2">
          <AlertCircle
            className="h-4 w-4 shrink-0"
            style={{ color: "var(--amber)" }}
          />
          <span
            className="font-mono text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "var(--amber)" }}
          >
            Execution Priority
          </span>
        </div>
        <p
          className="mb-4 font-sans text-[13px]"
          style={{ color: "var(--mut)" }}
        >
          Controls which workflows run first when multiple are triggered at the
          same time.
        </p>

        {/* Scale labels */}
        <div className="mb-1.5 flex items-center justify-between">
          <span
            className="font-mono text-[11px]"
            style={{ color: "var(--mut2)" }}
          >
            Low
          </span>
          <span
            className="font-mono text-[13px] font-bold"
            style={{ color: "var(--amber)" }}
          >
            {band}
          </span>
          <span
            className="font-mono text-[11px]"
            style={{ color: "var(--mut2)" }}
          >
            High
          </span>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={priority}
          onChange={(e) =>
            onChange({
              settings: {
                ...data.settings,
                priority: Number(e.target.value),
              },
            })
          }
          style={{
            accentColor: "var(--amber)",
            width: "100%",
            cursor: "pointer",
          }}
        />

        {/* Tick marks */}
        <div
          className="mt-1 flex justify-between font-mono text-[10px]"
          style={{ color: "var(--mut2)" }}
        >
          <span>1</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>

        {/* Live note */}
        <div
          className="mt-3 rounded-lg px-3 py-2 font-sans text-[12px]"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--line)",
            color: "var(--mut)",
          }}
        >
          Current:{" "}
          <span
            className="font-mono font-bold"
            style={{ color: "var(--amber)" }}
          >
            {priority}/100
          </span>{" "}
          — <span style={{ color: "var(--ink)" }}>{band} priority</span>
          {priority === 50 && (
            <span style={{ color: "var(--mut2)" }}> (default)</span>
          )}
          {". "}
          {band === "High"
            ? "Runs before all other workflows — use for critical automations."
            : band === "Low"
              ? "Runs after normal and high-priority workflows — good for background tasks."
              : "Standard execution order."}
        </div>
      </div>

      {/* ── Daily run limit ───────────────────────────────────────────── */}
      <div
        style={{
          background: tint("--blue", 7),
          border: `1px solid ${tint("--blue", 22)}`,
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <AlertCircle
            className="h-4 w-4 shrink-0"
            style={{ color: "var(--blue)" }}
          />
          <span
            className="font-mono text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "var(--blue)" }}
          >
            Max Runs Per Day
          </span>
        </div>
        <p
          className="mb-3 font-sans text-[13px]"
          style={{ color: "var(--mut)" }}
        >
          Caps how many times this workflow runs automatically per day. Manual
          “Run Now” runs don’t count. Leave blank for unlimited.
        </p>
        <input
          type="number"
          min={1}
          placeholder="Unlimited"
          value={data.settings?.maxRunsPerDay ?? ""}
          onChange={(e) =>
            onChange({
              settings: {
                ...data.settings,
                maxRunsPerDay: e.target.value
                  ? Math.max(1, Math.floor(Number(e.target.value)))
                  : undefined,
              },
            })
          }
          className="h-9 w-32 rounded-lg px-3 font-sans text-[13px] outline-none"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--line2)",
            color: "var(--ink)",
          }}
        />
      </div>
    </div>
  );
}
