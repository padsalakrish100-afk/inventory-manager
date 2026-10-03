-- Run BEFORE applying 20261003160000_decimal_money_weights (read-only).
--
-- Lists every stored value that rounding to the new scale would change by
-- more than floating-point noise (weights with more than 3 decimals, money
-- with more than 2) or that is too large for the new column. An empty
-- result means the migration loses nothing.
--
--   psql "$DATABASE_URL" -f prisma/checks/decimal-precheck.sql

SELECT 'Product' AS tbl, 'caratWeight' AS col, id, "caratWeight" AS value, ROUND("caratWeight"::numeric, 3) AS becomes FROM "Product"
  WHERE "caratWeight" IS NOT NULL AND (abs("caratWeight" - ROUND("caratWeight"::numeric, 3)::float8) > 1e-9 OR abs("caratWeight") >= 1e9)
UNION ALL
SELECT 'Product' AS tbl, 'costPrice' AS col, id, "costPrice" AS value, ROUND("costPrice"::numeric, 2) AS becomes FROM "Product"
  WHERE "costPrice" IS NOT NULL AND (abs("costPrice" - ROUND("costPrice"::numeric, 2)::float8) > 1e-9 OR abs("costPrice") >= 1e12)
UNION ALL
SELECT 'Product' AS tbl, 'sellingPrice' AS col, id, "sellingPrice" AS value, ROUND("sellingPrice"::numeric, 2) AS becomes FROM "Product"
  WHERE "sellingPrice" IS NOT NULL AND (abs("sellingPrice" - ROUND("sellingPrice"::numeric, 2)::float8) > 1e-9 OR abs("sellingPrice") >= 1e12)
UNION ALL
SELECT 'ProcessMovement' AS tbl, 'issueWeight' AS col, id, "issueWeight" AS value, ROUND("issueWeight"::numeric, 3) AS becomes FROM "ProcessMovement"
  WHERE "issueWeight" IS NOT NULL AND (abs("issueWeight" - ROUND("issueWeight"::numeric, 3)::float8) > 1e-9 OR abs("issueWeight") >= 1e9)
UNION ALL
SELECT 'ProcessMovement' AS tbl, 'returnWeight' AS col, id, "returnWeight" AS value, ROUND("returnWeight"::numeric, 3) AS becomes FROM "ProcessMovement"
  WHERE "returnWeight" IS NOT NULL AND (abs("returnWeight" - ROUND("returnWeight"::numeric, 3)::float8) > 1e-9 OR abs("returnWeight") >= 1e9)
UNION ALL
SELECT 'ProcessMovement' AS tbl, 'laborCost' AS col, id, "laborCost" AS value, ROUND("laborCost"::numeric, 2) AS becomes FROM "ProcessMovement"
  WHERE "laborCost" IS NOT NULL AND (abs("laborCost" - ROUND("laborCost"::numeric, 2)::float8) > 1e-9 OR abs("laborCost") >= 1e12)
UNION ALL
SELECT 'ProcessMovement' AS tbl, 'topsWeight' AS col, id, "topsWeight" AS value, ROUND("topsWeight"::numeric, 3) AS becomes FROM "ProcessMovement"
  WHERE "topsWeight" IS NOT NULL AND (abs("topsWeight" - ROUND("topsWeight"::numeric, 3)::float8) > 1e-9 OR abs("topsWeight") >= 1e9)
UNION ALL
SELECT 'PolishedStone' AS tbl, 'caratWeight' AS col, id, "caratWeight" AS value, ROUND("caratWeight"::numeric, 3) AS becomes FROM "PolishedStone"
  WHERE "caratWeight" IS NOT NULL AND (abs("caratWeight" - ROUND("caratWeight"::numeric, 3)::float8) > 1e-9 OR abs("caratWeight") >= 1e9)
UNION ALL
SELECT 'PolishedStone' AS tbl, 'askingPrice' AS col, id, "askingPrice" AS value, ROUND("askingPrice"::numeric, 2) AS becomes FROM "PolishedStone"
  WHERE "askingPrice" IS NOT NULL AND (abs("askingPrice" - ROUND("askingPrice"::numeric, 2)::float8) > 1e-9 OR abs("askingPrice") >= 1e12)
UNION ALL
SELECT 'PolishedStone' AS tbl, 'soldPrice' AS col, id, "soldPrice" AS value, ROUND("soldPrice"::numeric, 2) AS becomes FROM "PolishedStone"
  WHERE "soldPrice" IS NOT NULL AND (abs("soldPrice" - ROUND("soldPrice"::numeric, 2)::float8) > 1e-9 OR abs("soldPrice") >= 1e12)
UNION ALL
SELECT 'PolishedStone' AS tbl, 'roughCostAlloc' AS col, id, "roughCostAlloc" AS value, ROUND("roughCostAlloc"::numeric, 2) AS becomes FROM "PolishedStone"
  WHERE "roughCostAlloc" IS NOT NULL AND (abs("roughCostAlloc" - ROUND("roughCostAlloc"::numeric, 2)::float8) > 1e-9 OR abs("roughCostAlloc") >= 1e12)
UNION ALL
SELECT 'PolishedStone' AS tbl, 'laborCost' AS col, id, "laborCost" AS value, ROUND("laborCost"::numeric, 2) AS becomes FROM "PolishedStone"
  WHERE "laborCost" IS NOT NULL AND (abs("laborCost" - ROUND("laborCost"::numeric, 2)::float8) > 1e-9 OR abs("laborCost") >= 1e12)
UNION ALL
SELECT 'PolishedStone' AS tbl, 'certCost' AS col, id, "certCost" AS value, ROUND("certCost"::numeric, 2) AS becomes FROM "PolishedStone"
  WHERE "certCost" IS NOT NULL AND (abs("certCost" - ROUND("certCost"::numeric, 2)::float8) > 1e-9 OR abs("certCost") >= 1e12)
UNION ALL
SELECT 'PolishedStone' AS tbl, 'otherCost' AS col, id, "otherCost" AS value, ROUND("otherCost"::numeric, 2) AS becomes FROM "PolishedStone"
  WHERE "otherCost" IS NOT NULL AND (abs("otherCost" - ROUND("otherCost"::numeric, 2)::float8) > 1e-9 OR abs("otherCost") >= 1e12)
UNION ALL
SELECT 'Lot' AS tbl, 'roughWeight' AS col, id, "roughWeight" AS value, ROUND("roughWeight"::numeric, 3) AS becomes FROM "Lot"
  WHERE "roughWeight" IS NOT NULL AND (abs("roughWeight" - ROUND("roughWeight"::numeric, 3)::float8) > 1e-9 OR abs("roughWeight") >= 1e9)
UNION ALL
SELECT 'Lot' AS tbl, 'polishedWeight' AS col, id, "polishedWeight" AS value, ROUND("polishedWeight"::numeric, 3) AS becomes FROM "Lot"
  WHERE "polishedWeight" IS NOT NULL AND (abs("polishedWeight" - ROUND("polishedWeight"::numeric, 3)::float8) > 1e-9 OR abs("polishedWeight") >= 1e9)
UNION ALL
SELECT 'Lot' AS tbl, 'purchaseCost' AS col, id, "purchaseCost" AS value, ROUND("purchaseCost"::numeric, 2) AS becomes FROM "Lot"
  WHERE "purchaseCost" IS NOT NULL AND (abs("purchaseCost" - ROUND("purchaseCost"::numeric, 2)::float8) > 1e-9 OR abs("purchaseCost") >= 1e12)
UNION ALL
SELECT 'LotExpense' AS tbl, 'amount' AS col, id, "amount" AS value, ROUND("amount"::numeric, 2) AS becomes FROM "LotExpense"
  WHERE "amount" IS NOT NULL AND (abs("amount" - ROUND("amount"::numeric, 2)::float8) > 1e-9 OR abs("amount") >= 1e12)
UNION ALL
SELECT 'LotExpense' AS tbl, 'ratePerCarat' AS col, id, "ratePerCarat" AS value, ROUND("ratePerCarat"::numeric, 2) AS becomes FROM "LotExpense"
  WHERE "ratePerCarat" IS NOT NULL AND (abs("ratePerCarat" - ROUND("ratePerCarat"::numeric, 2)::float8) > 1e-9 OR abs("ratePerCarat") >= 1e12)
UNION ALL
SELECT 'LotExpense' AS tbl, 'caratMin' AS col, id, "caratMin" AS value, ROUND("caratMin"::numeric, 3) AS becomes FROM "LotExpense"
  WHERE "caratMin" IS NOT NULL AND (abs("caratMin" - ROUND("caratMin"::numeric, 3)::float8) > 1e-9 OR abs("caratMin") >= 1e9)
UNION ALL
SELECT 'LotExpense' AS tbl, 'caratMax' AS col, id, "caratMax" AS value, ROUND("caratMax"::numeric, 3) AS becomes FROM "LotExpense"
  WHERE "caratMax" IS NOT NULL AND (abs("caratMax" - ROUND("caratMax"::numeric, 3)::float8) > 1e-9 OR abs("caratMax") >= 1e9)
UNION ALL
SELECT 'ProcessRate' AS tbl, 'ratePerCarat' AS col, id, "ratePerCarat" AS value, ROUND("ratePerCarat"::numeric, 2) AS becomes FROM "ProcessRate"
  WHERE "ratePerCarat" IS NOT NULL AND (abs("ratePerCarat" - ROUND("ratePerCarat"::numeric, 2)::float8) > 1e-9 OR abs("ratePerCarat") >= 1e12)
UNION ALL
SELECT 'ProcessRate' AS tbl, 'caratMin' AS col, id, "caratMin" AS value, ROUND("caratMin"::numeric, 3) AS becomes FROM "ProcessRate"
  WHERE "caratMin" IS NOT NULL AND (abs("caratMin" - ROUND("caratMin"::numeric, 3)::float8) > 1e-9 OR abs("caratMin") >= 1e9)
UNION ALL
SELECT 'ProcessRate' AS tbl, 'caratMax' AS col, id, "caratMax" AS value, ROUND("caratMax"::numeric, 3) AS becomes FROM "ProcessRate"
  WHERE "caratMax" IS NOT NULL AND (abs("caratMax" - ROUND("caratMax"::numeric, 3)::float8) > 1e-9 OR abs("caratMax") >= 1e9)
ORDER BY 1, 2, 3;
