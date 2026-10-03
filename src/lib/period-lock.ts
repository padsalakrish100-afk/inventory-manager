import "server-only";
import type { Tx } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { APP_TIME_ZONE } from "@/lib/dates";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const monthLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });
const dayLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });

// YYYY-MM-DD of a moment in India time.
function istDay(d: Date): string {
  return dayFormat.format(d);
}

// Null when every date is in an open period; otherwise the message to show.
// Locks apply to everyone — an admin unlocks the period first.
export async function periodLockMessage(db: Tx | typeof prisma, dates: (Date | null | undefined)[]): Promise<string | null> {
  const days = [...new Set(dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime())).map(istDay))];
  if (days.length === 0) return null;
  const locks = await db.periodLock.findMany({ where: { unlockedAt: null }, select: { periodType: true, periodStart: true } });
  if (locks.length === 0) return null;
  const locked = new Set(locks.map((l) => `${l.periodType}:${l.periodStart.toISOString().slice(0, 10)}`));
  for (const day of days) {
    const month = `${day.slice(0, 7)}-01`;
    if (locked.has(`MONTH:${month}`)) {
      return `${monthLabel.format(new Date(`${month}T00:00:00Z`))} is closed. Ask an admin to unlock it in Settings → Period locks.`;
    }
    if (locked.has(`DAY:${day}`)) {
      return `${dayLabel.format(new Date(`${day}T00:00:00Z`))} is closed. Ask an admin to unlock it in Settings → Period locks.`;
    }
  }
  return null;
}

// Base for errors whose message is meant for the user. Each actions file's
// UserError extends it, and actions catch it to return the message.
export class UserFacingError extends Error {}

// For code inside a transaction: thrown when a date is in a closed period.
export class PeriodLockedError extends UserFacingError {}

export async function assertPeriodsOpen(db: Tx | typeof prisma, dates: (Date | null | undefined)[]): Promise<void> {
  const message = await periodLockMessage(db, dates);
  if (message) throw new PeriodLockedError(message);
}
