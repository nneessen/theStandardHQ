export interface ResponseScheduleDay {
  day: number;
  responsesEnabled: boolean;
  responseStartTime: string;
  responseEndTime: string;
  sameDayBookingEnabled: boolean;
  sameDayBookingCutoffTime: string | null;
}

export interface ResponseSchedule {
  days: ResponseScheduleDay[];
}

export const RESPONSE_SCHEDULE_DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const RESPONSE_SCHEDULE_DEFAULT_START = "08:00";
export const RESPONSE_SCHEDULE_DEFAULT_END = "20:30";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function createDefaultResponseScheduleDay(
  day: number,
): ResponseScheduleDay {
  return {
    day,
    responsesEnabled: true,
    responseStartTime: RESPONSE_SCHEDULE_DEFAULT_START,
    responseEndTime: RESPONSE_SCHEDULE_DEFAULT_END,
    sameDayBookingEnabled: true,
    sameDayBookingCutoffTime: null,
  };
}

export function normalizeResponseSchedule(
  schedule: ResponseSchedule | null | undefined,
): ResponseScheduleDay[] {
  const dayMap = new Map<number, Partial<ResponseScheduleDay>>();

  for (const entry of schedule?.days ?? []) {
    if (entry.day < 0 || entry.day > 6) continue;
    dayMap.set(entry.day, entry);
  }

  return Array.from({ length: 7 }, (_, day) => {
    const defaults = createDefaultResponseScheduleDay(day);
    const entry = dayMap.get(day);

    return {
      day,
      responsesEnabled: entry?.responsesEnabled ?? defaults.responsesEnabled,
      responseStartTime: entry?.responseStartTime ?? defaults.responseStartTime,
      responseEndTime: entry?.responseEndTime ?? defaults.responseEndTime,
      sameDayBookingEnabled:
        entry?.sameDayBookingEnabled ?? defaults.sameDayBookingEnabled,
      sameDayBookingCutoffTime:
        entry?.sameDayBookingCutoffTime ?? defaults.sameDayBookingCutoffTime,
    };
  });
}

export function validateResponseSchedule(
  days: ResponseScheduleDay[],
): string | null {
  const seenDays = new Set<number>();

  for (const day of days) {
    if (seenDays.has(day.day)) {
      return "Each day can only appear once in the response schedule.";
    }
    seenDays.add(day.day);

    if (day.day < 0 || day.day > 6) {
      return "Each schedule row must use a valid day from 0 to 6.";
    }

    if (
      !isValidTime(day.responseStartTime) ||
      !isValidTime(day.responseEndTime) ||
      (day.sameDayBookingCutoffTime !== null &&
        !isValidTime(day.sameDayBookingCutoffTime))
    ) {
      return "All times must use valid 24-hour HH:mm format.";
    }

    if (day.responsesEnabled && day.responseStartTime >= day.responseEndTime) {
      return "Response start time must be earlier than the response end time.";
    }
  }

  return null;
}

export function responseSchedulesEqual(
  left: ResponseScheduleDay[],
  right: ResponseScheduleDay[],
): boolean {
  return (
    JSON.stringify(normalizeDays(left)) === JSON.stringify(normalizeDays(right))
  );
}

export function toResponseSchedule(
  days: ResponseScheduleDay[],
): ResponseSchedule {
  return {
    days: normalizeDays(days),
  };
}

function normalizeDays(days: ResponseScheduleDay[]): ResponseScheduleDay[] {
  return [...days]
    .sort((a, b) => a.day - b.day)
    .map((day) => ({
      day: day.day,
      responsesEnabled: day.responsesEnabled,
      responseStartTime: day.responseStartTime,
      responseEndTime: day.responseEndTime,
      sameDayBookingEnabled: day.sameDayBookingEnabled,
      sameDayBookingCutoffTime: day.sameDayBookingCutoffTime,
    }));
}
