import "server-only";
import { num0 } from "@/lib/decimal";
import type { Tx } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// A payroll period is whole IST days: [from 00:00 IST, to+1 00:00 IST).
export function periodBounds(from: string, to: string): { start: Date; end: Date } {
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86_400_000);
  return { start, end };
}

function cents(value: { toString(): string } | number): number {
  return Math.round(Number(value) * 100);
}

export type PayrollLine = {
  partyId: string;
  name: string;
  entries: number;
  carats: number;
  pieces: number;
  labour: number; // cents
  bonus: number;
  deduction: number;
  advance: number;
  net: number;
  missingFx: number; // entries without an exchange rate
};

// Unpaid labour and adjustments per karigar in the period — what a payroll
// run for that period would settle. Amounts are in paise/cents (integers).
export async function unpaidPayroll(
  db: Tx | typeof prisma,
  start: Date,
  end: Date,
  partyId?: string,
): Promise<PayrollLine[]> {
  const [entries, adjustments] = await Promise.all([
    db.labourEntry.findMany({
      where: { voidedAt: null, payrollRunId: null, workDate: { gte: start, lt: end }, ...(partyId ? { partyId } : {}) },
      select: {
        partyId: true,
        amount: true,
        fxRate: true,
        quantity: true,
        basis: true,
        party: { select: { name: true } },
        movement: { select: { issueWeight: true, returnPieces: true, issuePieces: true } },
      },
    }),
    db.karigarAdjustment.findMany({
      where: { voidedAt: null, payrollRunId: null, date: { gte: start, lt: end }, ...(partyId ? { partyId } : {}) },
      select: { partyId: true, type: true, amount: true, party: { select: { name: true } } },
    }),
  ]);

  const lines = new Map<string, PayrollLine>();
  const line = (id: string, name: string) => {
    let l = lines.get(id);
    if (!l) {
      l = { partyId: id, name, entries: 0, carats: 0, pieces: 0, labour: 0, bonus: 0, deduction: 0, advance: 0, net: 0, missingFx: 0 };
      lines.set(id, l);
    }
    return l;
  };

  for (const e of entries) {
    const l = line(e.partyId, e.party.name);
    l.entries++;
    l.labour += cents(e.amount);
    l.carats += num0(e.movement.issueWeight);
    l.pieces += e.movement.returnPieces ?? e.movement.issuePieces;
    if (e.fxRate === null) l.missingFx++;
  }
  for (const a of adjustments) {
    const l = line(a.partyId, a.party.name);
    if (a.type === "BONUS") l.bonus += cents(a.amount);
    if (a.type === "DEDUCTION") l.deduction += cents(a.amount);
    if (a.type === "ADVANCE") l.advance += cents(a.amount);
  }
  for (const l of lines.values()) l.net = l.labour + l.bonus - l.deduction - l.advance;

  return [...lines.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function rupees(centsValue: number): string {
  return (centsValue / 100).toFixed(2);
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
export function formatInrCents(centsValue: number): string {
  return inr.format(centsValue / 100);
}
