// All dates are shown in India time (the factory's timezone), regardless of
// where the server runs — Vercel functions run in UTC.
export const APP_TIME_ZONE = "Asia/Kolkata";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}

// Today's date in IST as YYYY-MM-DD, for <input type="date"> defaults.
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date());
}

// A YYYY-MM-DD from a date picker → the moment to store. Today means "now"
// (keeps the real time of the entry); any other day is stored at midday IST
// so it can never slip into the neighbouring day in either timezone.
export function dateInputToInstant(value: string | null | undefined): Date {
  if (!value) return new Date();
  if (value === todayIST()) return new Date();
  const d = new Date(`${value}T12:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? new Date(value) : d;
}

// A YYYY-MM-DD → the start of that day in IST (for "effective from" dates).
export function dateInputToStartOfDayIST(value: string | null | undefined): Date {
  if (!value) return new Date();
  const d = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? new Date(value) : d;
}

// The moment `days` days ago — e.g. "issued before this is overdue".
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

export function daysSince(value: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / 86_400_000));
}
