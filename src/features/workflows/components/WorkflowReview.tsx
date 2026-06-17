// src/features/workflows/components/WorkflowReview.tsx
// Read-only summary of all four wizard steps — .theme-v2 Board design system.

import {
  Edit2,
  Mail,
  Bell,
  Clock,
  Webhook,
  Play,
  Calendar,
  Zap,
  MessageSquare,
  Database,
} from "lucide-react";
import type { WorkflowFormData } from "@/types/workflow.types";
import { tint, TRIGGER_ACCENT, ACTION_ACCENT } from "../board";

interface WorkflowReviewProps {
  data: WorkflowFormData;
  onEdit: (step: number) => void;
}

// ── tiny helpers ──────────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--surface-3)",
        border: "1px solid var(--line)",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  label,
  stepIndex,
  onEdit,
}: {
  label: string;
  stepIndex: number;
  onEdit: (s: number) => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span
        className="font-mono text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "var(--blue)" }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => onEdit(stepIndex)}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-4)]"
        style={{ color: "var(--mut2)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mut2)")}
        title="Edit this section"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function IconTile({
  accentVar,
  children,
}: {
  accentVar: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: tint(accentVar, 14),
        color: `var(${accentVar})`,
      }}
    >
      {children}
    </span>
  );
}

// ── icon maps ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- icon component type
const TRIGGER_ICONS: Record<string, any> = {
  manual: Play,
  schedule: Calendar,
  event: Zap,
  webhook: Webhook,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- icon component type
const ACTION_ICONS: Record<string, any> = {
  send_email: Mail,
  send_sms: MessageSquare,
  create_notification: Bell,
  wait: Clock,
  webhook: Webhook,
  update_field: Database,
};

const ACTION_LABELS: Record<string, string> = {
  send_email: "Send Email",
  send_sms: "Send SMS",
  create_notification: "Notification",
  wait: "Wait",
  webhook: "Webhook",
  update_field: "Update Field",
};

// ── main component ────────────────────────────────────────────────────────────

export default function WorkflowReview({ data, onEdit }: WorkflowReviewProps) {
  const priority = data.settings?.priority ?? 50;
  const priorityBand =
    priority < 34 ? "Low" : priority > 66 ? "High" : "Normal";
  const priorityDotColor =
    priority < 34 ? "--amber" : priority > 66 ? "--green" : "--blue";

  return (
    <div className="w-full space-y-4">
      {/* ── 1. Basic Information ───────────────────────────────────────────── */}
      <SectionCard>
        <CardHeader label="Basic Information" stepIndex={0} onEdit={onEdit} />
        <div className="space-y-1.5">
          <p
            className="font-display text-[22px] font-extrabold uppercase leading-tight tracking-wide"
            style={{ color: "var(--ink)" }}
          >
            {data.name || "Untitled Workflow"}
          </p>
          {data.description && (
            <p
              className="font-sans text-[14px]"
              style={{ color: "var(--mut)" }}
            >
              {data.description}
            </p>
          )}
          <span
            className="mt-2 inline-block rounded-md px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide"
            style={{
              background: tint("--blue", 12),
              color: "var(--blue)",
              border: `1px solid ${tint("--blue", 30)}`,
            }}
          >
            {data.category}
          </span>
        </div>
      </SectionCard>

      {/* ── 2. Trigger Configuration ──────────────────────────────────────── */}
      <SectionCard>
        <CardHeader
          label="Trigger Configuration"
          stepIndex={1}
          onEdit={onEdit}
        />
        {data.triggerType &&
          (() => {
            const accent = TRIGGER_ACCENT[data.triggerType] ?? "--blue";
            const TriggerIcon = TRIGGER_ICONS[data.triggerType];
            return (
              <div className="flex items-start gap-3">
                <IconTile accentVar={accent}>
                  {TriggerIcon && <TriggerIcon className="h-4.5 w-4.5" />}
                </IconTile>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-sans text-[15px] font-semibold capitalize"
                    style={{ color: "var(--ink)" }}
                  >
                    {data.triggerType} Trigger
                  </p>
                  <p
                    className="mt-0.5 font-sans text-[13.5px]"
                    style={{ color: "var(--mut)" }}
                  >
                    {data.triggerType === "schedule" &&
                      data.trigger?.schedule && (
                        <>
                          {data.trigger.schedule.dayOfWeek === "daily"
                            ? "Every day"
                            : data.trigger.schedule.dayOfWeek === "weekday"
                              ? "Weekdays"
                              : `Every ${data.trigger.schedule.dayOfWeek}`}{" "}
                          at {data.trigger.schedule.time}
                        </>
                      )}
                    {data.triggerType === "event" &&
                      data.trigger?.eventName && (
                        <span
                          className="font-mono text-[13px]"
                          style={{ color: "var(--cream)" }}
                        >
                          {data.trigger.eventName}
                        </span>
                      )}
                    {data.triggerType === "manual" && (
                      <>Manual — run from the workflows list</>
                    )}
                    {data.triggerType === "webhook" && (
                      <>Via webhook URL (generated after creation)</>
                    )}
                  </p>
                </div>
              </div>
            );
          })()}
      </SectionCard>

      {/* ── 3. Workflow Actions ───────────────────────────────────────────── */}
      <SectionCard>
        <CardHeader
          label={`Workflow Actions (${data.actions.length})`}
          stepIndex={2}
          onEdit={onEdit}
        />
        {data.actions.length === 0 ? (
          <div
            className="rounded-lg p-3"
            style={{
              background: tint("--amber", 10),
              border: `1px solid ${tint("--amber", 28)}`,
            }}
          >
            <p
              className="font-sans text-[13.5px] font-medium"
              style={{ color: "var(--amber)" }}
            >
              No actions configured. Add at least one action to define workflow
              behavior.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.actions.map((action, i) => {
              const accent = ACTION_ACCENT[action.type] ?? "--mut";
              const ActionIcon = ACTION_ICONS[action.type];
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    background: "var(--surface-4)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {/* step number */}
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                    style={{
                      background: tint(accent, 14),
                      color: `var(${accent})`,
                    }}
                  >
                    {i + 1}
                  </span>

                  {/* icon tile */}
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: tint(accent, 10),
                      color: `var(${accent})`,
                    }}
                  >
                    {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
                  </span>

                  {/* label + summary */}
                  <div className="flex-1 min-w-0">
                    <span
                      className="font-sans text-[14px] font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {ACTION_LABELS[action.type] || action.type}
                    </span>
                    {action.type === "send_email" &&
                      action.config.templateId && (
                        <span
                          className="ml-2 font-sans text-[13px]"
                          style={{ color: "var(--mut)" }}
                        >
                          Template configured
                        </span>
                      )}
                    {action.type === "wait" && action.config.waitMinutes && (
                      <span
                        className="ml-2 font-mono text-[12px]"
                        style={{ color: "var(--mut)" }}
                      >
                        {action.config.waitMinutes} min
                      </span>
                    )}
                    {action.type === "webhook" && action.config.webhookUrl && (
                      <span
                        className="ml-2 font-sans text-[13px]"
                        style={{ color: "var(--mut)" }}
                      >
                        URL configured
                      </span>
                    )}
                    {action.type === "create_notification" &&
                      action.config.title && (
                        <span
                          className="ml-2 font-sans text-[13px]"
                          style={{ color: "var(--mut)" }}
                        >
                          {action.config.title}
                        </span>
                      )}
                  </div>

                  {/* delay chip */}
                  {action.delayMinutes && action.delayMinutes > 0 ? (
                    <span
                      className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold"
                      style={{
                        background: tint("--violet", 12),
                        color: "var(--violet)",
                        border: `1px solid ${tint("--violet", 28)}`,
                      }}
                    >
                      +{action.delayMinutes}m
                    </span>
                  ) : (
                    <span
                      className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px]"
                      style={{
                        background: "var(--surface-2)",
                        color: "var(--mut2)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      immediate
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── 4. Workflow Settings ──────────────────────────────────────────── */}
      <SectionCard>
        <CardHeader label="Workflow Settings" stepIndex={3} onEdit={onEdit} />
        <div className="space-y-3">
          {/* max runs */}
          <div className="flex items-center gap-2.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: "var(--blue)" }}
            />
            <span
              className="font-sans text-[14px]"
              style={{ color: "var(--mut)" }}
            >
              Max runs per day:{" "}
              <strong style={{ color: "var(--ink)" }}>
                {data.settings?.maxRunsPerDay ?? 50}
              </strong>
            </span>
          </div>

          {/* priority */}
          <div className="flex items-center gap-2.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: `var(${priorityDotColor})` }}
            />
            <span
              className="font-sans text-[14px]"
              style={{ color: "var(--mut)" }}
            >
              Priority:{" "}
              <strong style={{ color: "var(--ink)" }}>
                {priorityBand} ({priority}/100)
              </strong>
            </span>
          </div>

          {/* cooldown */}
          {data.settings?.cooldownMinutes && (
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: "var(--cyan)" }}
              />
              <span
                className="font-sans text-[14px]"
                style={{ color: "var(--mut)" }}
              >
                Cooldown:{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {data.settings.cooldownMinutes} min
                </strong>
              </span>
            </div>
          )}

          {/* max per recipient */}
          {data.settings?.maxRunsPerRecipient && (
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: "var(--blue)" }}
              />
              <span
                className="font-sans text-[14px]"
                style={{ color: "var(--mut)" }}
              >
                Max per recipient:{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {data.settings.maxRunsPerRecipient}
                </strong>
              </span>
            </div>
          )}

          {/* continue on error */}
          {data.settings?.continueOnError && (
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: "var(--amber)" }}
              />
              <span
                className="font-sans text-[14px]"
                style={{ color: "var(--mut)" }}
              >
                Continue on error:{" "}
                <strong style={{ color: "var(--ink)" }}>Enabled</strong>
              </span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Validation banner ─────────────────────────────────────────────── */}
      {data.actions.length === 0 && (
        <div
          className="rounded-lg p-3"
          style={{
            background: tint("--red", 10),
            border: `1px solid ${tint("--red", 28)}`,
          }}
        >
          <p
            className="font-sans text-[13.5px] font-semibold"
            style={{ color: "var(--red)" }}
          >
            Workflow incomplete — add at least one action to continue.
          </p>
        </div>
      )}
    </div>
  );
}
