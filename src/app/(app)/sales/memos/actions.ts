"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { TX_OPTIONS, writeAudit, type AuditEntry } from "@/lib/audit";
import { recordStoneEvents, type StoneEventInput } from "@/lib/stone/events";
import { ensurePartyWithRole } from "@/lib/party";
import { usdInrOn } from "@/lib/fx";
import { centsToString, toCents } from "@/lib/money";
import { dateInputToInstant, todayIST } from "@/lib/dates";
import { parseInput, zCurrency, zDateString, zId, zOptionalFx, zOptionalText, zRequiredText } from "@/lib/validation";
import { nextDocumentNo } from "@/lib/sales/numbers";
import { parseDocLines } from "@/lib/sales/lines";
import { caratsOf, refreshMemoStatus } from "@/lib/sales/stones";
import { canTransition, STONE_STATUS_LABELS } from "@/lib/stone/status";

class UserError extends Error {}

const memoSchema = z.object({
  party: zRequiredText("Customer", 200),
  date: zDateString("Memo date"),
  dueDate: zDateString("Due date"),
  currency: zCurrency,
  fxRate: zOptionalFx,
  terms: zOptionalText(4000),
  notes: zOptionalText(1000),
});

// Sends stones out on memo (consignment) to a customer. Each stone must be
// in stock; it goes On memo, located with the customer.
export async function createSalesMemo(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  const viewer = await requirePermission("memo.manage");
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = parseInput(memoSchema, {
    party: str("party"),
    date: str("date") || todayIST(),
    dueDate: str("dueDate"),
    currency: str("currency") || "USD",
    fxRate: str("fxRate"),
    terms: str("terms"),
    notes: str("notes"),
  });
  if (!parsed.ok) return parsed.error;
  const lines = parseDocLines(formData.get("lines"));
  if (!lines.ok) return lines.error;
  const d = parsed.data;
  if (!d.dueDate) return "Enter the due date.";
  const date = dateInputToInstant(d.date);
  const dueDate = dateInputToInstant(d.dueDate);
  if (dueDate < date) return "The due date can't be before the memo date.";

  let memoId: string;
  try {
    memoId = await prisma.$transaction(async (tx) => {
      const fxRate = d.fxRate ?? (await usdInrOn(tx, date));
      if (!fxRate) throw new UserError("Enter the exchange rate (no rate on file for this date).");
      const party = await ensurePartyWithRole(tx, viewer.id, d.party, "CUSTOMER");

      const stones = await tx.product.findMany({
        where: { id: { in: lines.lines.map((l) => l.stoneId) } },
        include: { polishedStone: true },
      });
      const byId = new Map(stones.map((s) => [s.id, s]));
      for (const l of lines.lines) {
        const s = byId.get(l.stoneId);
        if (!s?.polishedStone) throw new UserError("One of the stones isn't in polished stock.");
        if (!canTransition(s.status, "ON_MEMO") || s.status === "ON_MEMO") {
          throw new UserError(`${s.polishedStone.stockId} is ${STONE_STATUS_LABELS[s.status].toLowerCase()} — only stones in stock can go on memo.`);
        }
      }

      const memoNo = await nextDocumentNo(tx, "SM", date);
      const memo = await tx.salesMemo.create({
        data: {
          memoNo,
          partyId: party.id,
          date,
          dueDate,
          terms: d.terms,
          currency: d.currency,
          fxRate,
          notes: d.notes,
          createdById: viewer.id,
          lines: {
            create: lines.lines.map((l) => {
              const s = byId.get(l.stoneId)!;
              const carats = caratsOf(s.polishedStone!, s);
              const cents = toCents(l.amount);
              return {
                stoneId: s.id,
                carats,
                amount: centsToString(cents),
                pricePerCt: Number(carats) > 0 ? centsToString(Math.round(cents / Number(carats))) : centsToString(cents),
              };
            }),
          },
        },
        include: { lines: true },
      });

      const audits: AuditEntry[] = [{ action: "CREATE", entity: "SalesMemo", entityId: memo.id, after: memo }];
      const events: StoneEventInput[] = [];
      for (const s of stones) {
        const after = await tx.product.update({
          where: { id: s.id },
          data: { status: "ON_MEMO", stockLocation: "ON_MEMO", locationPartyId: party.id },
        });
        await tx.polishedStone.update({ where: { id: s.polishedStone!.id }, data: { status: "ON_MEMO" } });
        const { polishedStone: _p, ...before } = s;
        audits.push({ action: "UPDATE", entity: "Product", entityId: s.id, before, after });
        events.push({
          stoneId: s.id, type: "MEMO", at: date, userId: viewer.id, partyId: party.id,
          refType: "SalesMemo", refId: memo.id, summary: `On memo ${memoNo} — ${party.name}`,
        });
      }
      await writeAudit(tx, viewer.id, audits);
      await recordStoneEvents(tx, events);
      return memo.id;
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return err.message;
    throw err;
  }

  revalidatePath("/sales/memos");
  revalidatePath("/polish", "layout");
  redirect(`/sales/memos/${memoId}`);
}

const returnSchema = z.object({
  memoId: zId,
  lineIds: z.array(zId).min(1, "Tick the stones that came back.").max(200),
  date: zDateString("Return date"),
  note: zOptionalText(300),
});

// Stones back from memo: in stock again, in the office safe.
export async function returnMemoLines(input: { memoId: string; lineIds: string[]; date: string; note: string }): Promise<{ error?: string }> {
  const viewer = await requirePermission("memo.manage");
  const parsed = parseInput(returnSchema, input);
  if (!parsed.ok) return { error: parsed.error };
  const { memoId, lineIds, note } = parsed.data;
  const at = dateInputToInstant(parsed.data.date);

  try {
    await prisma.$transaction(async (tx) => {
      const memo = await tx.salesMemo.findUnique({
        where: { id: memoId },
        include: { party: true, lines: { where: { id: { in: lineIds } }, include: { stone: { include: { polishedStone: true } } } } },
      });
      if (!memo || memo.voidedAt) throw new UserError("Memo not found.");
      if (memo.lines.length !== lineIds.length) throw new UserError("Some of those lines aren't on this memo.");
      if (at < memo.date) throw new UserError("The return date can't be before the memo date.");
      const audits: AuditEntry[] = [];
      const events: StoneEventInput[] = [];
      for (const line of memo.lines) {
        if (line.status !== "OUT") throw new UserError(`${line.stone.polishedStone?.stockId ?? line.stone.sku} isn't out on this memo.`);
        const lineAfter = await tx.salesMemoLine.update({ where: { id: line.id }, data: { status: "RETURNED", returnedAt: at } });
        const { stone, ...lineBefore } = line;
        const stoneAfter = await tx.product.update({
          where: { id: stone.id },
          data: { status: "IN_STOCK", stockLocation: "OFFICE_SAFE", locationPartyId: null },
        });
        if (stone.polishedStone) await tx.polishedStone.update({ where: { id: stone.polishedStone.id }, data: { status: "AVAILABLE" } });
        const { polishedStone: _p, ...stoneBefore } = stone;
        audits.push(
          { action: "UPDATE", entity: "SalesMemoLine", entityId: line.id, before: lineBefore, after: lineAfter },
          { action: "UPDATE", entity: "Product", entityId: stone.id, before: stoneBefore, after: stoneAfter },
        );
        events.push({
          stoneId: stone.id, type: "MEMO_RETURN", at, userId: viewer.id, partyId: memo.partyId,
          refType: "SalesMemo", refId: memo.id, summary: `Back from memo ${memo.memoNo} — ${memo.party.name}`,
          data: note ? { note } : undefined,
        });
      }
      await refreshMemoStatus(tx, [memo.id]);
      await writeAudit(tx, viewer.id, audits);
      await recordStoneEvents(tx, events);
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/sales/memos/${memoId}`);
  revalidatePath("/sales/memos");
  revalidatePath("/polish", "layout");
  return {};
}
