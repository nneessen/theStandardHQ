// src/features/social-studio/datetimeLocal.ts
// Format a Date as an <input type="datetime-local"> value in LOCAL time
// ("YYYY-MM-DDTHH:mm", no timezone suffix). Shared by the single-card and carousel
// schedulers so both prefill and clamp the picker's `min` to "now" identically.
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
