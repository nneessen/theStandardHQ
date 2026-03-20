import { describe, expect, it } from "vitest";

import {
  RESPONSE_SCHEDULE_DEFAULT_END,
  RESPONSE_SCHEDULE_DEFAULT_START,
  normalizeResponseSchedule,
  responseSchedulesEqual,
  toResponseSchedule,
  validateResponseSchedule,
} from "./response-schedule";

describe("response schedule helpers", () => {
  it("fills omitted days with backend defaults", () => {
    const days = normalizeResponseSchedule({
      days: [
        {
          day: 6,
          responsesEnabled: true,
          responseStartTime: "09:00",
          responseEndTime: "17:00",
          sameDayBookingEnabled: true,
          sameDayBookingCutoffTime: "15:00",
        },
      ],
    });

    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({
      day: 0,
      responsesEnabled: true,
      responseStartTime: RESPONSE_SCHEDULE_DEFAULT_START,
      responseEndTime: RESPONSE_SCHEDULE_DEFAULT_END,
      sameDayBookingEnabled: true,
      sameDayBookingCutoffTime: null,
    });
    expect(days[6]).toMatchObject({
      day: 6,
      responseStartTime: "09:00",
      responseEndTime: "17:00",
      sameDayBookingCutoffTime: "15:00",
    });
  });

  it("treats normalized default schedules as equal", () => {
    const fromNull = normalizeResponseSchedule(null);
    const explicitDefaults = normalizeResponseSchedule({
      days: Array.from({ length: 7 }, (_, day) => ({
        day,
        responsesEnabled: true,
        responseStartTime: RESPONSE_SCHEDULE_DEFAULT_START,
        responseEndTime: RESPONSE_SCHEDULE_DEFAULT_END,
        sameDayBookingEnabled: true,
        sameDayBookingCutoffTime: null,
      })),
    });

    expect(responseSchedulesEqual(fromNull, explicitDefaults)).toBe(true);
  });

  it("validates duplicate days and invalid time windows", () => {
    expect(
      validateResponseSchedule([
        {
          day: 1,
          responsesEnabled: true,
          responseStartTime: "09:00",
          responseEndTime: "17:00",
          sameDayBookingEnabled: true,
          sameDayBookingCutoffTime: null,
        },
        {
          day: 1,
          responsesEnabled: true,
          responseStartTime: "09:00",
          responseEndTime: "17:00",
          sameDayBookingEnabled: true,
          sameDayBookingCutoffTime: null,
        },
      ]),
    ).toMatch(/only appear once/i);

    expect(
      validateResponseSchedule([
        {
          day: 2,
          responsesEnabled: true,
          responseStartTime: "18:00",
          responseEndTime: "08:00",
          sameDayBookingEnabled: true,
          sameDayBookingCutoffTime: null,
        },
      ]),
    ).toMatch(/earlier than the response end time/i);
  });

  it("serializes sorted schedule payloads", () => {
    const schedule = toResponseSchedule([
      {
        day: 6,
        responsesEnabled: false,
        responseStartTime: "08:00",
        responseEndTime: "20:30",
        sameDayBookingEnabled: false,
        sameDayBookingCutoffTime: null,
      },
      {
        day: 0,
        responsesEnabled: true,
        responseStartTime: "09:00",
        responseEndTime: "17:00",
        sameDayBookingEnabled: true,
        sameDayBookingCutoffTime: "15:00",
      },
    ]);

    expect(schedule.days.map((day) => day.day)).toEqual([0, 6]);
  });
});
