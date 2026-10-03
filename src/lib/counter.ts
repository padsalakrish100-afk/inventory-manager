import "server-only";
import type { Tx } from "@/lib/audit";

// Atomically takes the next number for a document series. The upsert is a
// single INSERT ... ON CONFLICT DO UPDATE, so two people issuing at the
// same moment can never get the same number (unlike count() + 1).
export async function nextCounter(tx: Tx, key: string): Promise<number> {
  const row = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export async function nextMemoNumber(tx: Tx): Promise<string> {
  return `MEMO-${String(await nextCounter(tx, "MEMO")).padStart(5, "0")}`;
}

export async function nextStockId(tx: Tx): Promise<string> {
  return `P-${String(await nextCounter(tx, "STOCK")).padStart(4, "0")}`;
}
