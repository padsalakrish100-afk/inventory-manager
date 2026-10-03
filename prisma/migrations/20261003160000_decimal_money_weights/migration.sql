-- Exact decimals for the money and weight columns that pre-date the ERP
-- (approved data migration). Each column keeps its data; values are
-- rounded to the column's scale on the way in:
--   weights (carats) → DECIMAL(12,3), money → DECIMAL(14,2).
--
-- Rounding only changes the floating-point noise (e.g. 1.5199999999 → 1.520).
-- Run prisma/checks/decimal-precheck.sql against production first: it
-- lists any value that would change by more than that noise.
--
-- Each ALTER rewrites its table under a short exclusive lock; at this
-- business's data sizes that is seconds. Apply at a quiet time, together
-- with the deploy of the matching code (it reads these columns as
-- Decimal, not number).

ALTER TABLE "Product"
  ALTER COLUMN "caratWeight" SET DATA TYPE DECIMAL(12,3) USING ROUND("caratWeight"::numeric, 3),
  ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(14,2) USING ROUND("costPrice"::numeric, 2),
  ALTER COLUMN "sellingPrice" SET DATA TYPE DECIMAL(14,2) USING ROUND("sellingPrice"::numeric, 2);

ALTER TABLE "ProcessMovement"
  ALTER COLUMN "issueWeight" SET DATA TYPE DECIMAL(12,3) USING ROUND("issueWeight"::numeric, 3),
  ALTER COLUMN "returnWeight" SET DATA TYPE DECIMAL(12,3) USING ROUND("returnWeight"::numeric, 3),
  ALTER COLUMN "laborCost" SET DATA TYPE DECIMAL(14,2) USING ROUND("laborCost"::numeric, 2),
  ALTER COLUMN "topsWeight" SET DATA TYPE DECIMAL(12,3) USING ROUND("topsWeight"::numeric, 3);

ALTER TABLE "PolishedStone"
  ALTER COLUMN "caratWeight" SET DATA TYPE DECIMAL(12,3) USING ROUND("caratWeight"::numeric, 3),
  ALTER COLUMN "askingPrice" SET DATA TYPE DECIMAL(14,2) USING ROUND("askingPrice"::numeric, 2),
  ALTER COLUMN "soldPrice" SET DATA TYPE DECIMAL(14,2) USING ROUND("soldPrice"::numeric, 2),
  ALTER COLUMN "roughCostAlloc" SET DATA TYPE DECIMAL(14,2) USING ROUND("roughCostAlloc"::numeric, 2),
  ALTER COLUMN "laborCost" SET DATA TYPE DECIMAL(14,2) USING ROUND("laborCost"::numeric, 2),
  ALTER COLUMN "certCost" SET DATA TYPE DECIMAL(14,2) USING ROUND("certCost"::numeric, 2),
  ALTER COLUMN "otherCost" SET DATA TYPE DECIMAL(14,2) USING ROUND("otherCost"::numeric, 2);

ALTER TABLE "Lot"
  ALTER COLUMN "roughWeight" SET DATA TYPE DECIMAL(12,3) USING ROUND("roughWeight"::numeric, 3),
  ALTER COLUMN "polishedWeight" SET DATA TYPE DECIMAL(12,3) USING ROUND("polishedWeight"::numeric, 3),
  ALTER COLUMN "purchaseCost" SET DATA TYPE DECIMAL(14,2) USING ROUND("purchaseCost"::numeric, 2);

ALTER TABLE "LotExpense"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "ratePerCarat" SET DATA TYPE DECIMAL(14,2) USING ROUND("ratePerCarat"::numeric, 2),
  ALTER COLUMN "caratMin" SET DATA TYPE DECIMAL(12,3) USING ROUND("caratMin"::numeric, 3),
  ALTER COLUMN "caratMax" SET DATA TYPE DECIMAL(12,3) USING ROUND("caratMax"::numeric, 3);

ALTER TABLE "ProcessRate"
  ALTER COLUMN "ratePerCarat" SET DATA TYPE DECIMAL(14,2) USING ROUND("ratePerCarat"::numeric, 2),
  ALTER COLUMN "caratMin" SET DATA TYPE DECIMAL(12,3) USING ROUND("caratMin"::numeric, 3),
  ALTER COLUMN "caratMax" SET DATA TYPE DECIMAL(12,3) USING ROUND("caratMax"::numeric, 3);
