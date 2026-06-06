// src/lib/date.ts

export function parseLocalDate(dateString: string): Date {
  if (!dateString) {
    return new Date(0);
  }

  let datePart = dateString;
  if (dateString.includes("T")) {
    datePart = dateString.split("T")[0];
  }

  const [year, month, day] = datePart.split("-").map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    console.warn("Invalid date string format:", dateString);
    return new Date();
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function normalizeDatabaseDate(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";

  if (typeof date === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    return formatDateForDB(parseLocalDate(date.split("T")[0]));
  }

  return formatDateForDB(date);
}

export function formatDateForDB(date: Date | string): string {
  if (typeof date === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    date = parseLocalDate(date);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayString(): string {
  return formatDateForDB(new Date());
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === "string" ? parseLocalDate(date1) : date1;
  const d2 = typeof date2 === "string" ? parseLocalDate(date2) : date2;

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isSameMonth(
  date1: Date | string,
  date2: Date | string,
): boolean {
  const d1 = typeof date1 === "string" ? parseLocalDate(date1) : date1;
  const d2 = typeof date2 === "string" ? parseLocalDate(date2) : date2;

  return (
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
  );
}

export function isSameYear(
  date1: Date | string,
  date2: Date | string,
): boolean {
  const d1 = typeof date1 === "string" ? parseLocalDate(date1) : date1;
  const d2 = typeof date2 === "string" ? parseLocalDate(date2) : date2;

  return d1.getFullYear() === d2.getFullYear();
}

export function addDays(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return formatDateForDB(date);
}

export function addMonths(dateString: string, months: number): string {
  const date = parseLocalDate(dateString);
  date.setMonth(date.getMonth() + months);
  return formatDateForDB(date);
}

export function addYears(dateString: string, years: number): string {
  const date = parseLocalDate(dateString);
  date.setFullYear(date.getFullYear() + years);
  return formatDateForDB(date);
}

export function formatDateForDisplay(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: undefined,
  };

  return d.toLocaleDateString("en-US", { ...defaultOptions, ...options });
}
