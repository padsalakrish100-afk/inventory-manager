import "server-only";
import type { Tx } from "@/lib/audit";
import { nextCounter } from "@/lib/counter";
import { APP_TIME_ZONE } from "@/lib/dates";

// Yearly document series: SM-2026-0001 (sales memo), INV-2026-0001,
// RCPT-2026-0001 (money in), PAY-2026-0001 (money out). The year is the
// document date's year in India time.
export async function nextDocumentNo(tx: Tx, prefix: "SM" | "INV" | "RCPT" | "PAY", date: Date): Promise<string> {
  const year = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric" }).format(date);
  const n = await nextCounter(tx, `${prefix}-${year}`);
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}
