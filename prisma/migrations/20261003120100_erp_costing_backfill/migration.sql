-- Backfill for the cost ledger (20261003120000_erp_costing). The cost
-- figures typed onto polished stones before the ledger existed become
-- ledger rows, in the currency they were entered in (the stone's sale
-- currency). No exchange rate was recorded then, so only that currency's
-- amount is filled. The original PolishedStone columns are left untouched.
-- Labour typed on a polished stone is only carried over when the stone has
-- no labour entries of its own (otherwise it would be counted twice).

INSERT INTO "CostEntry" ("id", "stoneId", "type", "date", "amount", "currency", "amountUsd", "amountInr", "sourceType", "sourceId", "note")
SELECT 'cst_' || md5(s."id" || ':' || t.type), s."sourceProductId", t.type::"CostType", s."createdAt",
       ROUND(t.amount::numeric, 2), s."currency",
       CASE WHEN s."currency" = 'USD' THEN ROUND(t.amount::numeric, 2) END,
       CASE WHEN s."currency" = 'INR' THEN ROUND(t.amount::numeric, 2) END,
       'LEGACY_POLISH', s."id", 'Entered on the Polish sale form before the cost ledger'
FROM "PolishedStone" s
CROSS JOIN LATERAL (VALUES
  ('ROUGH', s."roughCostAlloc"),
  ('CERTIFICATION', s."certCost"),
  ('OTHER', s."otherCost"),
  ('LABOUR', CASE WHEN NOT EXISTS (
      SELECT 1 FROM "LabourEntry" l JOIN "ProcessMovement" m ON m."id" = l."movementId"
      WHERE m."productId" = s."sourceProductId" AND l."voidedAt" IS NULL
    ) THEN s."laborCost" END)
) AS t(type, amount)
WHERE t.amount IS NOT NULL AND t.amount > 0
ON CONFLICT ("id") DO NOTHING;
