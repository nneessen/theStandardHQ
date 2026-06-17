// src/features/workflows/components/WorkflowTriggerSetup.tsx

import { useState, useEffect } from "react";
import { Play, Calendar, Zap, Webhook } from "lucide-react";
import type {
  WorkflowFormData,
  TriggerType,
  WorkflowTrigger,
} from "@/types/workflow.types";
import { useTriggerEventTypes } from "@/hooks/workflows";
import EventTriggerPicker from "./EventTriggerPicker";
import { tint, TRIGGER_ACCENT } from "../board";

interface WorkflowTriggerSetupProps {
  data: WorkflowFormData;
  onChange: (updates: Partial<WorkflowFormData>) => void;
  errors: Record<string, string>;
}

const TRIGGER_TYPES: {
  value: TriggerType;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: "manual",
    label: "Manual",
    icon: Play,
    description: "Run on demand from the workflows list",
  },
  {
    value: "schedule",
    label: "Schedule",
    icon: Calendar,
    description: "Run automatically at a recurring time",
  },
  {
    value: "event",
    label: "Event",
    icon: Zap,
    description: "Fire when something happens in the system",
  },
  {
    value: "webhook",
    label: "Webhook",
    icon: Webhook,
    description: "Triggered by an incoming HTTP request",
  },
];

export default function WorkflowTriggerSetup({
  data,
  onChange,
  errors,
}: WorkflowTriggerSetupProps) {
  const { data: eventTypes = [] } = useTriggerEventTypes();
  const [scheduleTime, setScheduleTime] = useState(
    data.trigger?.schedule?.time || "09:00",
  );
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(
    data.trigger?.schedule?.dayOfWeek || "daily",
  );
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  // Update parent when schedule changes
  useEffect(() => {
    if (data.triggerType === "schedule") {
      const newTrigger: WorkflowTrigger = {
        type: "schedule",
        schedule: {
          time: scheduleTime,
          dayOfWeek: scheduleDayOfWeek,
        },
      };
      onChange({ trigger: newTrigger });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange is a stable prop callback
  }, [scheduleTime, scheduleDayOfWeek, data.triggerType]);

  const handleTriggerTypeChange = (type: TriggerType) => {
    // Create proper trigger object based on type
    let newTrigger: WorkflowTrigger;

    switch (type) {
      case "manual":
        newTrigger = { type: "manual" };
        break;
      case "schedule":
        newTrigger = {
          type: "schedule",
          schedule: {
            time: scheduleTime,
            dayOfWeek: scheduleDayOfWeek,
          },
        };
        break;
      case "event":
        newTrigger = {
          type: "event",
          eventName: data.trigger?.eventName, // Preserve selected event if any
        };
        break;
      case "webhook":
        newTrigger = {
          type: "webhook",
          webhookConfig: data.trigger?.webhookConfig,
        };
        break;
      default:
        newTrigger = { type: "manual" };
    }

    console.log("[WorkflowTriggerSetup] Changing trigger type to:", {
      newType: type,
      newTrigger,
      preservedEventName: data.trigger?.eventName,
    });

    // Update both triggerType and trigger together
    onChange({
      triggerType: type,
      trigger: newTrigger,
    });
  };

  const handleEventChange = (eventName: string) => {
    const newTrigger: WorkflowTrigger = {
      type: "event",
      eventName,
    };

    console.log("[WorkflowTriggerSetup] Selecting event:", {
      eventName,
      newTrigger,
    });

    // Ensure both triggerType and trigger are updated
    onChange({
      triggerType: "event",
      trigger: newTrigger,
    });
  };

  const selectedEventType = eventTypes.find(
    (e) => e.eventName === data.trigger?.eventName,
  );

  const typeLabel = data.triggerType
    ? data.triggerType.charAt(0).toUpperCase() + data.triggerType.slice(1)
    : "";

  return (
    <div className="w-full space-y-5">
      {/* ── Eyebrow + 2×2 trigger-type grid ─────────────────────────────── */}
      <div>
        <p
          className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--mut2)" }}
        >
          Select Trigger Type
        </p>

        <div className="grid grid-cols-2 gap-3">
          {TRIGGER_TYPES.map((trigger) => {
            const Icon = trigger.icon;
            const isSelected = data.triggerType === trigger.value;
            const accent = TRIGGER_ACCENT[trigger.value];

            return (
              <button
                key={trigger.value}
                type="button"
                onClick={() => handleTriggerTypeChange(trigger.value)}
                className="relative flex items-start gap-3 rounded-xl p-4 text-left transition-all"
                style={{
                  background: isSelected ? tint(accent, 8) : "var(--surface-2)",
                  border: isSelected
                    ? `1px solid var(${accent})`
                    : "1px solid var(--line)",
                  boxShadow: isSelected
                    ? `0 0 0 3px ${tint(accent, 16)}`
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background = "var(--surface-3)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background = "var(--surface-2)";
                }}
              >
                {/* Radio dot — top right */}
                <span
                  className="absolute right-3 top-3 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all"
                  style={{
                    border: isSelected
                      ? `1px solid var(${accent})`
                      : "1px solid var(--line3)",
                    background: isSelected ? `var(${accent})` : "transparent",
                  }}
                >
                  {isSelected && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "#0c1322" }}
                    />
                  )}
                </span>

                {/* 48px accent-tinted icon tile */}
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: tint(accent, 14),
                    color: `var(${accent})`,
                  }}
                >
                  <Icon className="h-6 w-6" />
                </span>

                {/* Label + description */}
                <div className="min-w-0 pt-0.5">
                  <p
                    className="font-sans text-[15px] font-bold leading-tight"
                    style={{ color: "var(--ink)" }}
                  >
                    {trigger.label}
                  </p>
                  <p
                    className="mt-0.5 font-sans text-[13px] leading-snug"
                    style={{ color: "var(--mut)" }}
                  >
                    {trigger.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Per-type configuration ─────────────────────────────────────── */}
      {data.triggerType && (
        <div>
          <p
            className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--mut2)" }}
          >
            Configure {typeLabel} Trigger
          </p>

          {/* Manual */}
          {data.triggerType === "manual" && (
            <div
              className="rounded-xl p-4"
              style={{
                background: tint("--blue", 8),
                border: `1px solid ${tint("--blue", 24)}`,
              }}
            >
              <p
                className="font-sans text-[14px]"
                style={{ color: "var(--blue)" }}
              >
                This workflow will only run when you manually trigger it from
                the workflows list.
              </p>
            </div>
          )}

          {/* Webhook */}
          {data.triggerType === "webhook" && (
            <div
              className="rounded-xl p-4"
              style={{
                background: tint("--cyan", 8),
                border: `1px solid ${tint("--cyan", 24)}`,
              }}
            >
              <p
                className="font-sans text-[14px]"
                style={{ color: "var(--cyan)" }}
              >
                A unique webhook URL will be generated after you create this
                workflow.
              </p>
            </div>
          )}

          {/* Schedule */}
          {data.triggerType === "schedule" && (
            <div className="space-y-3">
              <div
                className="rounded-xl p-4"
                style={{
                  background: tint("--amber", 8),
                  border: `1px solid ${tint("--amber", 24)}`,
                }}
              >
                <p
                  className="font-sans text-[14px]"
                  style={{ color: "var(--amber)" }}
                >
                  Schedule this workflow to run automatically at a specific
                  time.
                </p>
              </div>

              <div className="flex gap-3">
                {/* Time */}
                <div className="flex-1">
                  <p
                    className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--mut2)" }}
                  >
                    Time
                  </p>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="h-10 w-full rounded-lg px-3 font-sans text-[14px] outline-none transition-shadow"
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--line2)",
                      color: "var(--ink)",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.boxShadow =
                        "0 0 0 3px " + tint("--amber", 30))
                    }
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  />
                </div>

                {/* Frequency */}
                <div className="flex-1">
                  <p
                    className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--mut2)" }}
                  >
                    Frequency
                  </p>
                  <select
                    value={scheduleDayOfWeek}
                    onChange={(e) => setScheduleDayOfWeek(e.target.value)}
                    className="h-10 w-full rounded-lg px-3 font-sans text-[14px] outline-none transition-shadow appearance-none"
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--line2)",
                      color: "var(--ink)",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.boxShadow =
                        "0 0 0 3px " + tint("--amber", 30))
                    }
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekday">Weekdays</option>
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
              </div>

              {errors.schedule && (
                <p
                  className="font-sans text-[13px]"
                  style={{ color: "var(--red)" }}
                >
                  {errors.schedule}
                </p>
              )}
            </div>
          )}

          {/* Event */}
          {data.triggerType === "event" && (
            <div className="space-y-3">
              {/* Selected event card or dashed "Choose" button */}
              {data.trigger?.eventName ? (
                <div
                  className="flex items-start gap-3 rounded-xl p-4"
                  style={{
                    background: tint("--violet", 8),
                    border: `1px solid ${tint("--violet", 28)}`,
                  }}
                >
                  {/* Violet Zap tile */}
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: tint("--violet", 16),
                      color: "var(--violet)",
                    }}
                  >
                    <Zap className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className="font-mono text-[14px] font-bold leading-tight"
                      style={{ color: "var(--cream)" }}
                    >
                      {data.trigger.eventName}
                    </p>
                    {selectedEventType?.description && (
                      <p
                        className="mt-0.5 font-sans text-[13px] leading-snug"
                        style={{ color: "var(--mut)" }}
                      >
                        {selectedEventType.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEventDialogOpen(true)}
                    className="shrink-0 rounded-lg px-3 py-1.5 font-sans text-[12px] font-semibold transition-colors"
                    style={{
                      background: tint("--violet", 14),
                      color: "var(--violet)",
                      border: `1px solid ${tint("--violet", 36)}`,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = tint("--violet", 22))
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = tint("--violet", 14))
                    }
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEventDialogOpen(true)}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl font-sans text-[14px] font-semibold transition-colors"
                  style={{
                    background: "transparent",
                    border: "1.5px dashed var(--line2)",
                    color: "var(--mut)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tint("--violet", 6);
                    e.currentTarget.style.borderColor = `var(--violet)`;
                    e.currentTarget.style.color = "var(--violet)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "var(--line2)";
                    e.currentTarget.style.color = "var(--mut)";
                  }}
                >
                  <Zap className="h-4 w-4" />
                  Choose an event…
                </button>
              )}

              {errors.trigger && (
                <p
                  className="font-sans text-[13px]"
                  style={{ color: "var(--red)" }}
                >
                  {errors.trigger}
                </p>
              )}

              {/* Event picker dialog — preserved exactly */}
              <EventTriggerPicker
                open={eventDialogOpen}
                onOpenChange={setEventDialogOpen}
                eventTypes={eventTypes}
                selectedEvent={data.trigger?.eventName}
                onSelectEvent={handleEventChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
