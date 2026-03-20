import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { useChatBotAgent, useUpdateBotConfig } from "../hooks/useChatBot";
import {
  RESPONSE_SCHEDULE_DAY_LABELS,
  normalizeResponseSchedule,
  responseSchedulesEqual,
  toResponseSchedule,
  validateResponseSchedule,
} from "../lib/response-schedule";

export function ResponseScheduleSection() {
  const { data: agent } = useChatBotAgent();
  const updateConfig = useUpdateBotConfig();

  const normalizedAgentSchedule = useMemo(
    () => normalizeResponseSchedule(agent?.responseSchedule ?? null),
    [agent?.responseSchedule],
  );

  const [days, setDays] = useState(normalizedAgentSchedule);

  useEffect(() => {
    setDays(normalizedAgentSchedule);
  }, [normalizedAgentSchedule]);

  const validationError = useMemo(() => validateResponseSchedule(days), [days]);
  const isDirty = useMemo(
    () => !responseSchedulesEqual(days, normalizedAgentSchedule),
    [days, normalizedAgentSchedule],
  );
  const hasCustomSchedule = agent?.responseSchedule != null;

  const updateDay = (
    dayIndex: number,
    updater: (current: (typeof days)[number]) => (typeof days)[number],
  ) => {
    setDays((current) =>
      current.map((day) => (day.day === dayIndex ? updater(day) : day)),
    );
  };

  const applyWeekdayPreset = () => {
    setDays((current) =>
      current.map((day) =>
        day.day >= 1 && day.day <= 5
          ? {
              ...day,
              responsesEnabled: true,
              responseStartTime: "09:00",
              responseEndTime: "17:00",
              sameDayBookingEnabled: true,
              sameDayBookingCutoffTime: null,
            }
          : {
              ...day,
              responsesEnabled: false,
              sameDayBookingEnabled: false,
              sameDayBookingCutoffTime: null,
            },
      ),
    );
  };

  const handleSave = () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    updateConfig.mutate({
      responseSchedule: toResponseSchedule(days),
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="flex flex-col gap-3 border-b border-zinc-100 dark:border-zinc-800 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                Response Schedule
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Uses the lead&apos;s timezone when available, otherwise the
                agent timezone.
              </p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Control when the bot can reply and when same-day booking stops being
            offered or confirmed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={applyWeekdayPreset}
            disabled={updateConfig.isPending}
          >
            Weekdays 9-5
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => setDays(normalizedAgentSchedule)}
            disabled={!isDirty || updateConfig.isPending}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset Edits
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => updateConfig.mutate({ responseSchedule: null })}
            disabled={!hasCustomSchedule || updateConfig.isPending}
          >
            Use Backend Defaults
          </Button>
        </div>
      </div>

      <div className="hidden border-b border-zinc-100 px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 xl:grid xl:grid-cols-[110px_110px_240px_130px_220px] xl:gap-3">
        <span>Day</span>
        <span>Responses</span>
        <span>Reply Window</span>
        <span>Same-Day</span>
        <span>Cutoff</span>
      </div>

      <div className="space-y-2 p-4">
        {days.map((day) => {
          const usesResponseEndForCutoff =
            day.sameDayBookingCutoffTime === null;

          return (
            <div
              key={day.day}
              className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40"
            >
              <div className="grid gap-3 xl:grid-cols-[110px_110px_240px_130px_220px] xl:items-center">
                <div className="flex items-center justify-between gap-3 xl:block">
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {RESPONSE_SCHEDULE_DAY_LABELS[day.day]}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {day.responsesEnabled
                        ? `${day.responseStartTime} - ${day.responseEndTime}`
                        : "Replies deferred"}
                    </p>
                  </div>
                  <div className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[9px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 xl:hidden">
                    {day.sameDayBookingEnabled
                      ? `Same-day ${usesResponseEndForCutoff ? "until end" : `until ${day.sameDayBookingCutoffTime}`}`
                      : "No same-day"}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 xl:justify-start">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 xl:hidden">
                    Responses
                  </span>
                  <Switch
                    checked={day.responsesEnabled}
                    onCheckedChange={(checked) =>
                      updateDay(day.day, (current) => ({
                        ...current,
                        responsesEnabled: checked,
                      }))
                    }
                    disabled={updateConfig.isPending}
                    variant="success"
                    size="sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 xl:hidden">
                      Start
                    </span>
                    <input
                      type="time"
                      value={day.responseStartTime}
                      onChange={(event) =>
                        updateDay(day.day, (current) => ({
                          ...current,
                          responseStartTime: event.target.value,
                        }))
                      }
                      disabled={!day.responsesEnabled || updateConfig.isPending}
                      className={cn(
                        "h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-[11px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
                        !day.responsesEnabled &&
                          "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
                      )}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 xl:hidden">
                      End
                    </span>
                    <input
                      type="time"
                      value={day.responseEndTime}
                      onChange={(event) =>
                        updateDay(day.day, (current) => ({
                          ...current,
                          responseEndTime: event.target.value,
                          sameDayBookingCutoffTime:
                            current.sameDayBookingCutoffTime === null
                              ? null
                              : current.sameDayBookingCutoffTime,
                        }))
                      }
                      disabled={!day.responsesEnabled || updateConfig.isPending}
                      className={cn(
                        "h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-[11px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
                        !day.responsesEnabled &&
                          "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
                      )}
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3 xl:justify-start">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 xl:hidden">
                    Same-Day Booking
                  </span>
                  <Switch
                    checked={day.sameDayBookingEnabled}
                    onCheckedChange={(checked) =>
                      updateDay(day.day, (current) => ({
                        ...current,
                        sameDayBookingEnabled: checked,
                        sameDayBookingCutoffTime: checked
                          ? current.sameDayBookingCutoffTime
                          : null,
                      }))
                    }
                    disabled={updateConfig.isPending}
                    size="sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={
                        day.sameDayBookingCutoffTime ?? day.responseEndTime
                      }
                      onChange={(event) =>
                        updateDay(day.day, (current) => ({
                          ...current,
                          sameDayBookingCutoffTime: event.target.value,
                        }))
                      }
                      disabled={
                        !day.sameDayBookingEnabled ||
                        usesResponseEndForCutoff ||
                        updateConfig.isPending
                      }
                      className={cn(
                        "h-8 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-[11px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
                        (!day.sameDayBookingEnabled ||
                          usesResponseEndForCutoff) &&
                          "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-[10px]"
                      onClick={() =>
                        updateDay(day.day, (current) => ({
                          ...current,
                          sameDayBookingCutoffTime:
                            current.sameDayBookingCutoffTime === null
                              ? current.responseEndTime
                              : null,
                        }))
                      }
                      disabled={
                        !day.sameDayBookingEnabled || updateConfig.isPending
                      }
                    >
                      {usesResponseEndForCutoff ? "Use Custom" : "Use End"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {day.sameDayBookingEnabled
                      ? usesResponseEndForCutoff
                        ? "Same-day booking follows the response end time."
                        : `Same-day booking stops at ${day.sameDayBookingCutoffTime}.`
                      : "Same-day booking is blocked for this day."}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {validationError && (
          <p className="text-[10px] text-red-500">{validationError}</p>
        )}

        {isDirty && (
          <div className="flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <Button
              size="sm"
              className="h-8 text-[10px]"
              onClick={handleSave}
              disabled={updateConfig.isPending || !!validationError}
            >
              {updateConfig.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 h-3 w-3" />
              )}
              Save Schedule
            </Button>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Saving writes explicit day rules to the existing agent config API.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
