-- Backfill for the karigar module (20261003110000_erp_karigar). Writes only
-- new columns and new tables. Safe to re-run.

-- Existing per-carat rates become rate-card rows for their stage.
UPDATE "ProcessRate" r SET
  "processStageId" = s."id",
  "basis" = 'PER_CARAT',
  "rate" = ROUND(r."ratePerCarat"::numeric, 2)
FROM "ProcessStage" s
WHERE r."processStageId" IS NULL AND r."process" IS NOT NULL AND s."legacyProcess" = r."process";

-- A profile for every karigar, and their departments inferred from the
-- stages they have actually worked on.
INSERT INTO "KarigarProfile" ("partyId", "updatedAt")
SELECT p."id", CURRENT_TIMESTAMP FROM "Party" p
WHERE 'KARIGAR' = ANY(p."roles")
ON CONFLICT ("partyId") DO NOTHING;

INSERT INTO "KarigarDepartment" ("partyId", "departmentId")
SELECT DISTINCT m."partyId", s."departmentId"
FROM "ProcessMovement" m
JOIN "ProcessStage" s ON s."id" = m."stageId"
JOIN "Party" p ON p."id" = m."partyId"
WHERE s."departmentId" IS NOT NULL AND 'KARIGAR' = ANY(p."roles")
ON CONFLICT DO NOTHING;

-- Labour already priced at issue time (the pre-ERP way) on returned,
-- non-voided entries becomes a labour entry. Amounts are taken exactly as
-- recorded, assumed INR (the app always showed them in ₹); no exchange rate
-- was recorded then, so fxRate stays empty.
INSERT INTO "LabourEntry" ("id", "movementId", "partyId", "stageId", "workDate", "basis", "rate", "quantity", "amount", "currency", "source", "createdAt")
SELECT
  'lab_' || md5(m."id"),
  m."id",
  m."partyId",
  m."stageId",
  m."returnDate",
  'PER_CARAT',
  CASE WHEN COALESCE(m."issueWeight", 0) > 0 THEN ROUND((m."laborCost" / m."issueWeight")::numeric, 2) ELSE ROUND(m."laborCost"::numeric, 2) END,
  ROUND(COALESCE(m."issueWeight", 1)::numeric, 3),
  ROUND(m."laborCost"::numeric, 2),
  'INR',
  'LEGACY',
  CURRENT_TIMESTAMP
FROM "ProcessMovement" m
WHERE m."laborCost" IS NOT NULL
  AND m."returnDate" IS NOT NULL
  AND m."voidedAt" IS NULL
  AND m."partyId" IS NOT NULL
ON CONFLICT ("movementId") DO NOTHING;
