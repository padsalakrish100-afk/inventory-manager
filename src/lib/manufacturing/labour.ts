import "server-only";
import type { Tx } from "@/lib/audit";
import { usdInrOn } from "@/lib/fx";

// The rate card in force for a karigar at a stage on a date: their own rate
// beats the stage default; within each, the latest effectiveFrom ≤ date.
export async function findRateCard(tx: Tx, stageId: string, partyId: string, date: Date) {
  const own = await tx.processRate.findFirst({
    where: { processStageId: stageId, partyId, effectiveFrom: { lte: date }, rate: { not: null } },
    orderBy: { effectiveFrom: "desc" },
  });
  if (own) return own;
  return tx.processRate.findFirst({
    where: { processStageId: stageId, partyId: null, effectiveFrom: { lte: date }, rate: { not: null } },
    orderBy: { effectiveFrom: "desc" },
  });
}

// Prices labour for a just-completed return and creates its LabourEntry.
// No entry when: the stage isn't labour-billable, the stone went to a
// department (no karigar), the party is an outside job-worker (they bill
// separately), or no rate card applies.
export async function createLabourForReturn(
  tx: Tx,
  movement: {
    id: string;
    partyId: string | null;
    stageId: string | null;
    issueWeight: number | null;
    issuePieces: number;
    returnPieces: number | null;
    laborCost: number | null;
  },
  stage: { id: string; isLabourBillable: boolean } | null,
  workDate: Date,
) {
  if (!movement.partyId || !stage || !stage.isLabourBillable) return null;

  const party = await tx.party.findUnique({ where: { id: movement.partyId }, select: { roles: true } });
  if (!party || !party.roles.includes("KARIGAR")) return null;

  const fxRate = await usdInrOn(tx, workDate);

  // Pre-ERP issues priced labour at issue time — honour that figure.
  if (movement.laborCost !== null) {
    const qty = movement.issueWeight ?? 1;
    return tx.labourEntry.create({
      data: {
        movementId: movement.id,
        partyId: movement.partyId,
        stageId: stage.id,
        workDate,
        basis: "PER_CARAT",
        rate: qty > 0 ? (movement.laborCost / qty).toFixed(2) : movement.laborCost.toFixed(2),
        quantity: qty.toFixed(3),
        amount: movement.laborCost.toFixed(2),
        currency: "INR",
        fxRate,
        source: "ISSUE_RATE",
      },
    });
  }

  const card = await findRateCard(tx, stage.id, movement.partyId, workDate);
  if (!card || card.rate === null) return null;

  // Per carat is charged on the weight issued (the work handed over).
  const quantity =
    card.basis === "PER_CARAT"
      ? (movement.issueWeight ?? 0)
      : card.basis === "PER_PIECE"
        ? (movement.returnPieces ?? movement.issuePieces)
        : 1;
  if (quantity <= 0) return null;

  // rate (2 dp) × quantity (3 dp) in integers, rounded to whole paise.
  const rateCents = Math.round(Number(card.rate) * 100);
  const qtyMilli = Math.round(quantity * 1000);
  const amount = (Math.round((rateCents * qtyMilli) / 1000) / 100).toFixed(2);

  return tx.labourEntry.create({
    data: {
      movementId: movement.id,
      partyId: movement.partyId,
      stageId: stage.id,
      workDate,
      basis: card.basis,
      rate: card.rate,
      quantity: quantity.toFixed(3),
      amount,
      currency: card.currency,
      fxRate,
      source: "RATE_CARD",
      rateCardId: card.id,
    },
  });
}
