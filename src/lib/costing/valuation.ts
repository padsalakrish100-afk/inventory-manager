import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Stones whose cost is still "in inventory" (not sold, not passed on to
// split children, not written off).
export const VALUED_STATUSES = ["IN_PRODUCTION", "POLISHED", "AT_LAB", "IN_STOCK", "ON_MEMO", "RETURNED"] as const;

export type ValuationRow = {
  status: string;
  location: string;
  stones: number;
  carats: number;
  costUsd: number;
  costInr: number;
  askingUsd: number;
  askingInr: number;
  pricedCostUsd: number; // cost of just the stones that have an asking price
  unpriced: number; // stones without an asking price
};

// Inventory at cost (ledger + labour) and at asking price, grouped by status
// and location — one SQL aggregate, so it stays fast at 50,000+ stones.
// Asking prices are converted with today's exchange rate.
export async function inventoryValuation(filters: { status?: string; location?: string }, usdInr: number | null) {
  const statusFilter = filters.status ? Prisma.sql`AND p."status"::text = ${filters.status}` : Prisma.empty;
  const locationFilter = filters.location ? Prisma.sql`AND p."stockLocation"::text = ${filters.location}` : Prisma.empty;
  // Sent as text and cast, so Postgres never guesses an integer type for it.
  const fx = Prisma.sql`${String(usdInr ?? 0)}::numeric`;

  const rows = await prisma.$queryRaw<
    {
      status: string;
      location: string;
      stones: bigint;
      carats: number | null;
      cost_usd: Prisma.Decimal | null;
      cost_inr: Prisma.Decimal | null;
      asking_usd: Prisma.Decimal | null;
      asking_inr: Prisma.Decimal | null;
      priced_cost_usd: Prisma.Decimal | null;
      unpriced: bigint;
    }[]
  >`
    WITH ledger AS (
      SELECT "stoneId", SUM("amountUsd") AS usd, SUM("amountInr") AS inr
      FROM "CostEntry" WHERE "voidedAt" IS NULL GROUP BY "stoneId"
    ),
    labour AS (
      SELECT m."productId" AS "stoneId",
             SUM(CASE WHEN l."currency" = 'USD' THEN l."amount" WHEN l."fxRate" > 0 THEN l."amount" / l."fxRate" END) AS usd,
             SUM(CASE WHEN l."currency" = 'INR' THEN l."amount" WHEN l."fxRate" > 0 THEN l."amount" * l."fxRate" END) AS inr
      FROM "LabourEntry" l JOIN "ProcessMovement" m ON m."id" = l."movementId"
      WHERE l."voidedAt" IS NULL GROUP BY m."productId"
    )
    SELECT p."status"::text AS status,
           p."stockLocation"::text AS location,
           COUNT(*) AS stones,
           SUM(COALESCE(ps."caratWeight", p."caratWeight")) AS carats,
           SUM(COALESCE(lg.usd, 0) + COALESCE(lb.usd, 0)) AS cost_usd,
           SUM(COALESCE(lg.inr, 0) + COALESCE(lb.inr, 0)) AS cost_inr,
           SUM(CASE WHEN ps."currency" = 'USD' THEN ps."askingPrice"
                    WHEN ps."currency" = 'INR' AND ${fx} > 0 THEN ps."askingPrice" / ${fx} END) AS asking_usd,
           SUM(CASE WHEN ps."currency" = 'INR' THEN ps."askingPrice"
                    WHEN ps."currency" = 'USD' THEN ps."askingPrice" * ${fx} END) AS asking_inr,
           SUM(COALESCE(lg.usd, 0) + COALESCE(lb.usd, 0)) FILTER (WHERE ps."askingPrice" IS NOT NULL) AS priced_cost_usd,
           COUNT(*) FILTER (WHERE ps."askingPrice" IS NULL) AS unpriced
    FROM "Product" p
    LEFT JOIN "PolishedStone" ps ON ps."sourceProductId" = p."id"
    LEFT JOIN ledger lg ON lg."stoneId" = p."id"
    LEFT JOIN labour lb ON lb."stoneId" = p."id"
    WHERE p."deletedAt" IS NULL
      AND p."status"::text IN (${Prisma.join([...VALUED_STATUSES])})
      ${statusFilter} ${locationFilter}
    GROUP BY 1, 2
    ORDER BY 1, 2`;

  return rows.map(
    (r): ValuationRow => ({
      status: r.status,
      location: r.location,
      stones: Number(r.stones),
      carats: Number(r.carats ?? 0),
      costUsd: Number(r.cost_usd ?? 0),
      costInr: Number(r.cost_inr ?? 0),
      askingUsd: Number(r.asking_usd ?? 0),
      askingInr: Number(r.asking_inr ?? 0),
      pricedCostUsd: Number(r.priced_cost_usd ?? 0),
      unpriced: Number(r.unpriced),
    }),
  );
}
