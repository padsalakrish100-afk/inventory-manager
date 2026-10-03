import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/audit";

export type StoneEventType =
  | "CREATED"
  | "ISSUE"
  | "RETURN"
  | "UNDO"
  | "VOID"
  | "BREAKAGE"
  | "SPLIT"
  | "EXCESS_REVIEWED"
  | "TRANSFER_TO_POLISH"
  | "UNDO_TRANSFER"
  | "STATUS"
  | "LOCATION"
  | "WEIGHT"
  | "SOLD"
  | "MEMO"
  | "MEMO_RETURN"
  | "SALE_VOID";

export type StoneEventInput = {
  stoneId: string;
  type: StoneEventType;
  at?: Date;
  userId?: string | null;
  partyId?: string | null;
  weightBefore?: number | string | null;
  weightAfter?: number | string | null;
  refType?: string;
  refId?: string;
  summary: string;
  data?: Prisma.InputJsonValue;
};

function weight(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : null;
}

export async function recordStoneEvents(tx: Tx, events: StoneEventInput[]): Promise<void> {
  if (events.length === 0) return;
  await tx.stoneEvent.createMany({
    data: events.map((e) => ({
      stoneId: e.stoneId,
      type: e.type,
      at: e.at ?? new Date(),
      userId: e.userId ?? null,
      partyId: e.partyId ?? null,
      weightBefore: weight(e.weightBefore),
      weightAfter: weight(e.weightAfter),
      refType: e.refType ?? null,
      refId: e.refId ?? null,
      summary: e.summary,
      data: e.data,
    })),
  });
}
