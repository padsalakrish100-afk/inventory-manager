-- Backfill for the ERP manufacturing columns added in
-- 20261003100000_erp_manufacturing. Writes only those new columns; no
-- pre-existing value changes. Safe to re-run (IS NULL guards).

-- Every existing movement and memo points at the stage for its process.
UPDATE "ProcessMovement" m SET "stageId" = s."id"
FROM "ProcessStage" s
WHERE m."stageId" IS NULL AND m."process" IS NOT NULL AND s."legacyProcess" = m."process";

UPDATE "Memo" mo SET "stageId" = s."id"
FROM "ProcessStage" s
WHERE mo."stageId" IS NULL AND mo."process" IS NOT NULL AND s."legacyProcess" = mo."process";

-- Loss on every completed movement: issue − return − tops (tops are cut
-- pieces that were recovered, not lost). No loss limits existed before, so
-- nothing historical is flagged as excess.
UPDATE "ProcessMovement" SET
  "lossWeight" = ROUND(("issueWeight" - "returnWeight" - COALESCE("topsWeight", 0))::numeric, 3),
  "lossPct" = CASE WHEN "issueWeight" > 0
    THEN ROUND((("issueWeight" - "returnWeight" - COALESCE("topsWeight", 0)) / "issueWeight" * 100)::numeric, 3)
    END
WHERE "lossWeight" IS NULL
  AND "returnDate" IS NOT NULL
  AND "issueWeight" IS NOT NULL
  AND "returnWeight" IS NOT NULL;
