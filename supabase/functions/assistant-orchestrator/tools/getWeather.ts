// Current conditions + short-range forecast for a place, via Open-Meteo (keyless, no
// per-user connection, no PII, no money, no OS). The first read-only EXTERNAL tool — it
// proves the new capability-metadata shape (actionClass:"read", target:"cloud") end to end.
//
// Pure parsing (summarizeWeather / weatherCodeText) is split out so it unit-tests offline
// with sample payloads; run() does the two fetches via globalThis.fetch (stubbable in tests).

import type { AssistantToolContext, RegisteredTool } from "./types.ts";
import { optionalString } from "./types.ts";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

type When = "now" | "today" | "tomorrow" | "week";
type Units = "imperial" | "metric";

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

// US state/territory abbreviations -> full names. Open-Meteo's geocoder matches the city
// token against the admin1 FULL name, never a "City, ST" string, so "Austin, TX" must become
// city "Austin" + region "Texas".
const US_STATE_ABBR: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

/** Split "Austin, TX" / "Paris, France" into a city token + an optional region hint. */
export function parseLocation(location: string): {
  city: string;
  region: string | null;
} {
  const idx = location.indexOf(",");
  if (idx === -1) return { city: location.trim(), region: null };
  const city = location.slice(0, idx).trim();
  const region = location.slice(idx + 1).trim();
  return { city: city || location.trim(), region: region || null };
}

/** Pick the geocode result best matching a region hint (state name/abbrev or country). */
export function pickGeo(
  results: GeoResult[],
  region: string | null,
): GeoResult | undefined {
  if (results.length === 0) return undefined;
  if (!region) return results[0];
  const r = region.toLowerCase();
  const full = (US_STATE_ABBR[region.toUpperCase()] ?? "").toLowerCase();
  const match = results.find((g) => {
    const admin1 = (g.admin1 ?? "").toLowerCase();
    const country = (g.country ?? "").toLowerCase();
    return (
      admin1 === r ||
      (full !== "" && admin1 === full) ||
      (r.length >= 3 && admin1.startsWith(r)) ||
      country === r ||
      (r.length >= 3 && country.startsWith(r))
    );
  });
  return match ?? results[0];
}

// WMO weather-code -> plain text (the subset Open-Meteo emits).
const WEATHER_CODE_TEXT: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "freezing fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  56: "freezing drizzle",
  57: "heavy freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "heavy freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light rain showers",
  81: "rain showers",
  82: "violent rain showers",
  85: "light snow showers",
  86: "snow showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "thunderstorm with heavy hail",
};

export function weatherCodeText(code: unknown): string {
  return typeof code === "number" && code in WEATHER_CODE_TEXT
    ? WEATHER_CODE_TEXT[code]
    : "unknown";
}

const round = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;

/** Shape Open-Meteo's geocode + forecast JSON into a compact, model-friendly summary. */
export function summarizeWeather(
  geo: GeoResult,
  forecast: Record<string, unknown>,
  when: When,
  units: Units,
): Record<string, unknown> {
  const place = [geo.name, geo.admin1, geo.country]
    .filter((s) => typeof s === "string" && s)
    .join(", ");
  const tempUnit = units === "imperial" ? "°F" : "°C";
  const windUnit = units === "imperial" ? "mph" : "km/h";

  const cur = (forecast.current ?? {}) as Record<string, unknown>;
  const current =
    when === "now" || when === "today"
      ? {
          temp: round(cur.temperature_2m),
          feelsLike: round(cur.apparent_temperature),
          condition: weatherCodeText(cur.weather_code),
          humidityPct: round(cur.relative_humidity_2m),
          windSpeed: round(cur.wind_speed_10m),
          isDay: cur.is_day === 1 || cur.is_day === true,
        }
      : undefined;

  const daily = (forecast.daily ?? {}) as Record<string, unknown>;
  const dates = Array.isArray(daily.time) ? (daily.time as string[]) : [];
  const codes = Array.isArray(daily.weather_code)
    ? (daily.weather_code as unknown[])
    : [];
  const highs = Array.isArray(daily.temperature_2m_max)
    ? (daily.temperature_2m_max as unknown[])
    : [];
  const lows = Array.isArray(daily.temperature_2m_min)
    ? (daily.temperature_2m_min as unknown[])
    : [];
  const precip = Array.isArray(daily.precipitation_probability_max)
    ? (daily.precipitation_probability_max as unknown[])
    : [];

  const dayAt = (i: number) => ({
    date: dates[i],
    high: round(highs[i]),
    low: round(lows[i]),
    condition: weatherCodeText(codes[i]),
    precipChancePct: round(precip[i]),
  });

  let days: ReturnType<typeof dayAt>[] = [];
  if (dates.length > 0) {
    if (when === "tomorrow") days = dates[1] ? [dayAt(1)] : [];
    else if (when === "week") days = dates.map((_, i) => dayAt(i)).slice(0, 7);
    else days = [dayAt(0)]; // now / today
  }

  return {
    location: place,
    units: { temp: tempUnit, wind: windUnit },
    ...(current ? { current } : {}),
    daily: days,
  };
}

async function run(input: Record<string, unknown>, _ctx: AssistantToolContext) {
  const location = optionalString(input, "location");
  if (!location) return { available: false, reason: "location_required" };

  const whenRaw = optionalString(input, "when");
  const when: When =
    whenRaw === "today" ||
    whenRaw === "tomorrow" ||
    whenRaw === "week" ||
    whenRaw === "now"
      ? whenRaw
      : "now";
  const units: Units =
    optionalString(input, "units") === "metric" ? "metric" : "imperial";

  const { city, region } = parseLocation(location);
  // ONE shared 8s deadline for both fetches — a stalled Open-Meteo connection otherwise hangs
  // run() (and, on the text surface, the whole orchestrator turn) indefinitely; the outer
  // try/catch only catches thrown errors, and a connected-but-silent socket never throws.
  const signal = AbortSignal.timeout(8000);

  try {
    const geoParams = new URLSearchParams({
      name: city,
      // Pull a few candidates when a region is given so pickGeo can disambiguate (e.g. the
      // many "Austin"s) by matching admin1/country; otherwise the single best match.
      count: region ? "5" : "1",
      language: "en",
      format: "json",
    });
    const geoRes = await fetch(`${GEOCODE_URL}?${geoParams}`, { signal });
    if (!geoRes.ok) return { available: false, reason: "unavailable" };
    const geoJson = (await geoRes.json()) as { results?: GeoResult[] };
    const geo = pickGeo(geoJson.results ?? [], region);
    if (!geo) return { available: false, reason: "location_not_found" };

    const fcParams = new URLSearchParams({
      latitude: String(geo.latitude),
      longitude: String(geo.longitude),
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      temperature_unit: units === "imperial" ? "fahrenheit" : "celsius",
      wind_speed_unit: units === "imperial" ? "mph" : "kmh",
      precipitation_unit: units === "imperial" ? "inch" : "mm",
      timezone: "auto",
      forecast_days: "7",
    });
    const fcRes = await fetch(`${FORECAST_URL}?${fcParams}`, { signal });
    if (!fcRes.ok) return { available: false, reason: "unavailable" };
    const forecast = (await fcRes.json()) as Record<string, unknown>;

    return {
      available: true,
      data: summarizeWeather(geo, forecast, when, units),
    };
  } catch {
    return { available: false, reason: "unavailable" };
  }
}

export const getWeather: RegisteredTool = {
  name: "getWeather",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description:
          "Place to get weather for — a city, 'City, State', or region (e.g. 'Boston', 'Austin, TX').",
      },
      when: {
        type: "string",
        enum: ["now", "today", "tomorrow", "week"],
        description:
          "Time window. Defaults to 'now' (current conditions + today).",
      },
      units: {
        type: "string",
        enum: ["imperial", "metric"],
        description: "Defaults to 'imperial' (°F, mph).",
      },
    },
    required: ["location"],
    additionalProperties: false,
  },
  run,
};
