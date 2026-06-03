import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  getWeather,
  summarizeWeather,
  weatherCodeText,
} from "../getWeather.ts";
import type { AssistantToolContext } from "../types.ts";

const ctx = {} as unknown as AssistantToolContext; // getWeather ignores ctx (no db)

const GEO = {
  name: "Boston",
  admin1: "Massachusetts",
  country: "United States",
  latitude: 42.36,
  longitude: -71.06,
};
const FORECAST = {
  current: {
    temperature_2m: 72.4,
    apparent_temperature: 70.1,
    relative_humidity_2m: 55,
    weather_code: 2,
    wind_speed_10m: 8.3,
    is_day: 1,
  },
  daily: {
    time: ["2026-06-03", "2026-06-04"],
    weather_code: [2, 61],
    temperature_2m_max: [80.2, 75.0],
    temperature_2m_min: [60.1, 58.9],
    precipitation_probability_max: [10, 80],
  },
};

Deno.test("weatherCodeText maps WMO codes, falls back to 'unknown'", () => {
  assertEquals(weatherCodeText(0), "clear sky");
  assertEquals(weatherCodeText(61), "light rain");
  assertEquals(weatherCodeText(999), "unknown");
  assertEquals(weatherCodeText("x"), "unknown");
});

Deno.test("summarizeWeather (now) returns rounded current + today", () => {
  const s = summarizeWeather(GEO, FORECAST, "now", "imperial") as Record<
    string,
    // deno-lint-ignore no-explicit-any
    any
  >;
  assertEquals(s.location, "Boston, Massachusetts, United States");
  assertEquals(s.units, { temp: "°F", wind: "mph" });
  assertEquals(s.current.temp, 72);
  assertEquals(s.current.feelsLike, 70);
  assertEquals(s.current.condition, "partly cloudy");
  assertEquals(s.current.windSpeed, 8);
  assertEquals(s.current.isDay, true);
  assertEquals(s.daily.length, 1);
  assertEquals(s.daily[0], {
    date: "2026-06-03",
    high: 80,
    low: 60,
    condition: "partly cloudy",
    precipChancePct: 10,
  });
});

Deno.test(
  "summarizeWeather (tomorrow) picks day index 1, no current block",
  () => {
    const s = summarizeWeather(GEO, FORECAST, "tomorrow", "imperial") as Record<
      string,
      // deno-lint-ignore no-explicit-any
      any
    >;
    assertEquals(s.current, undefined);
    assertEquals(s.daily.length, 1);
    assertEquals(s.daily[0].date, "2026-06-04");
    assertEquals(s.daily[0].condition, "light rain");
    assertEquals(s.daily[0].precipChancePct, 80);
  },
);

Deno.test("summarizeWeather (week) returns all available days", () => {
  const s = summarizeWeather(GEO, FORECAST, "week", "metric") as Record<
    string,
    // deno-lint-ignore no-explicit-any
    any
  >;
  assertEquals(s.units, { temp: "°C", wind: "km/h" });
  assertEquals(s.daily.length, 2);
});

Deno.test(
  "getWeather.run returns location_required when no location given",
  async () => {
    const r = (await getWeather.run({}, ctx)) as Record<string, unknown>;
    assertEquals(r, { available: false, reason: "location_required" });
  },
);

Deno.test(
  "getWeather.run returns location_not_found on empty geocode",
  async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
      })) as typeof fetch;
    try {
      const r = (await getWeather.run(
        { location: "Nowheresville" },
        ctx,
      )) as Record<string, unknown>;
      assertEquals(r, { available: false, reason: "location_not_found" });
    } finally {
      globalThis.fetch = original;
    }
  },
);

Deno.test("getWeather.run happy path: geocode then forecast", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes("geocoding-api")) {
      return new Response(JSON.stringify({ results: [GEO] }), { status: 200 });
    }
    return new Response(JSON.stringify(FORECAST), { status: 200 });
  }) as typeof fetch;
  try {
    const r = (await getWeather.run({ location: "Boston" }, ctx)) as Record<
      string,
      // deno-lint-ignore no-explicit-any
      any
    >;
    assert(r.available);
    assertEquals(r.data.location, "Boston, Massachusetts, United States");
    assertEquals(r.data.current.temp, 72);
  } finally {
    globalThis.fetch = original;
  }
});
