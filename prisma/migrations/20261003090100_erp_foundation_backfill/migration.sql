-- Data backfill for the ERP foundation. Only INSERTs into the new tables and
-- UPDATEs of the new columns added in 20261003090000_erp_foundation; no
-- pre-existing column's value is changed. Safe to re-run (ON CONFLICT and
-- IS NULL guards throughout).

-- ─── Departments ────────────────────────────────────────────────────────────
INSERT INTO "Department" ("id", "name", "sortOrder") VALUES
  ('dept_planning',  'Planning',        10),
  ('dept_marking',   'Marking',         20),
  ('dept_sawing',    'Sawing',          30),
  ('dept_bruting',   'Bruting',         40),
  ('dept_blocking',  'Blocking',        50),
  ('dept_polishing', 'Polishing',       60),
  ('dept_qc',        'Quality Control', 70),
  ('dept_office',    'Office',          80)
ON CONFLICT ("name") DO NOTHING;

-- ─── Process stages ─────────────────────────────────────────────────────────
-- Every existing ProcessName value becomes a stage (linked via legacyProcess
-- so old movements map onto it), plus the ERP default stages that were not
-- in the enum yet. All editable or deactivatable from Settings → Stages.
INSERT INTO "ProcessStage" ("id", "code", "name", "sortOrder", "departmentId", "legacyProcess", "isLabourBillable") VALUES
  ('stage_galaxy',          'GALAXY',          'Galaxy',          10,  'dept_planning',  'GALAXY',          true),
  ('stage_planning',        'PLANNING',        'Planning',        20,  'dept_planning',  'PLANNING',        true),
  ('stage_marking',         'MARKING',         'Marking',         30,  'dept_marking',   NULL,              true),
  ('stage_green_sawing',    'GREEN_SAWING',    'Green Sawing',    40,  'dept_sawing',    'GREEN_SAWING',    true),
  ('stage_quazer_sawing',   'QUAZER_SAWING',   'Quazer Sawing',   50,  'dept_sawing',    'QUAZER_SAWING',   true),
  ('stage_waterjet_sawing', 'WATERJET_SAWING', 'Waterjet Sawing', 60,  'dept_sawing',    'WATERJET_SAWING', true),
  ('stage_bruting',         'BRUTING',         'Bruting',         70,  'dept_bruting',   'BRUTING',         true),
  ('stage_blocking',        'BLOCKING',        'Blocking',        80,  'dept_blocking',  NULL,              true),
  ('stage_chabka',          'CHABKA',          'Chabka',          90,  'dept_blocking',  'CHABKA',          true),
  ('stage_polishing',       'POLISHING',       'Polishing',       100, 'dept_polishing', 'POLISHING',       true),
  ('stage_final_qc',        'FINAL_QC',        'Final QC',        110, 'dept_qc',        NULL,              false),
  ('stage_certification',   'CERTIFICATION',   'Certification',   120, 'dept_office',    NULL,              false)
ON CONFLICT ("code") DO NOTHING;

-- ─── Party roles ────────────────────────────────────────────────────────────
-- From the single category, the older type, and actual usage: a party that
-- has been issued stones is a karigar, a lot source is a vendor, and a buyer
-- is a customer.
UPDATE "Party" p SET "roles" = ARRAY(
  SELECT DISTINCT r FROM unnest(
    COALESCE(p."roles", ARRAY[]::"PartyRoleType"[])
    || CASE p."category"
         WHEN 'TENDER_VENDOR' THEN ARRAY['VENDOR']::"PartyRoleType"[]
         WHEN 'KARIGAR'       THEN ARRAY['KARIGAR']::"PartyRoleType"[]
         WHEN 'CUSTOMER'      THEN ARRAY['CUSTOMER']::"PartyRoleType"[]
         ELSE ARRAY[]::"PartyRoleType"[]
       END
    || CASE
         WHEN p."category" IS NULL AND p."type" = 'SUPPLIER' THEN ARRAY['VENDOR']::"PartyRoleType"[]
         WHEN p."category" IS NULL AND p."type" = 'CUSTOMER' THEN ARRAY['CUSTOMER']::"PartyRoleType"[]
         ELSE ARRAY[]::"PartyRoleType"[]
       END
    || CASE WHEN EXISTS (SELECT 1 FROM "ProcessMovement" m WHERE m."partyId" = p."id")
         THEN ARRAY['KARIGAR']::"PartyRoleType"[] ELSE ARRAY[]::"PartyRoleType"[] END
    || CASE WHEN EXISTS (SELECT 1 FROM "Lot" l WHERE l."sourcePartyId" = p."id")
         THEN ARRAY['VENDOR']::"PartyRoleType"[] ELSE ARRAY[]::"PartyRoleType"[] END
    || CASE WHEN EXISTS (SELECT 1 FROM "PolishedStone" s WHERE s."buyerId" = p."id")
         THEN ARRAY['CUSTOMER']::"PartyRoleType"[] ELSE ARRAY[]::"PartyRoleType"[] END
  ) AS r ORDER BY r
);

-- ─── Users ──────────────────────────────────────────────────────────────────
-- STAFF users could see every cost before roles existed. Keep that access
-- until an admin changes it on the Users page.
UPDATE "User" SET "canSeeCosts" = true WHERE "role" = 'STAFF';

-- ─── Stone status and location ──────────────────────────────────────────────
UPDATE "Product" p SET
  "status" = (CASE s."status" WHEN 'SOLD' THEN 'SOLD' WHEN 'ON_MEMO' THEN 'ON_MEMO' ELSE 'IN_STOCK' END)::"StoneStatus",
  "stockLocation" = (CASE s."status" WHEN 'SOLD' THEN 'SOLD' WHEN 'ON_MEMO' THEN 'ON_MEMO' ELSE 'OFFICE_SAFE' END)::"StoneLocation",
  "locationPartyId" = CASE WHEN s."status" IN ('ON_MEMO', 'SOLD') THEN s."buyerId" ELSE NULL END
FROM "PolishedStone" s
WHERE s."sourceProductId" = p."id";

UPDATE "Product" p SET "currentStageId" = st."id", "currentDepartmentId" = st."departmentId"
FROM "ProcessStage" st
WHERE p."currentProcess" IS NOT NULL AND st."legacyProcess" = p."currentProcess" AND p."currentStageId" IS NULL;

-- Rough weight = the weight the stone was first issued at. For a stone never
-- issued (and not polished), its currently recorded weight.
UPDATE "Product" p SET "roughWeight" = ROUND(first_issue."issueWeight"::numeric, 3)
FROM (
  SELECT DISTINCT ON ("productId") "productId", "issueWeight"
  FROM "ProcessMovement"
  WHERE "issueWeight" IS NOT NULL
  ORDER BY "productId", "issueDate" ASC, "createdAt" ASC
) first_issue
WHERE first_issue."productId" = p."id" AND p."roughWeight" IS NULL;

UPDATE "Product" p SET "roughWeight" = ROUND(p."caratWeight"::numeric, 3)
WHERE p."roughWeight" IS NULL
  AND p."caratWeight" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ProcessMovement" m WHERE m."productId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "PolishedStone" s WHERE s."sourceProductId" = p."id");

-- ─── Counters ───────────────────────────────────────────────────────────────
-- Continue from the highest number already issued, and never below the row
-- count (what the old count()+1 numbering was based on).
INSERT INTO "Counter" ("key", "value")
SELECT 'MEMO', GREATEST(
  COALESCE(MAX(CASE WHEN "memoNumber" ~ '^MEMO-[0-9]+$' THEN CAST(SUBSTRING("memoNumber" FROM 6) AS INTEGER) END), 0),
  COUNT(*)::int
) FROM "Memo"
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Counter" ("key", "value")
SELECT 'STOCK', GREATEST(
  COALESCE(MAX(CASE WHEN "stockId" ~ '^P-[0-9]+$' THEN CAST(SUBSTRING("stockId" FROM 3) AS INTEGER) END), 0),
  COUNT(*)::int
) FROM "PolishedStone"
ON CONFLICT ("key") DO NOTHING;

-- ─── Stone timeline from existing history ───────────────────────────────────
-- Deterministic ids (md5 of the source row id) so this can never double-insert.
INSERT INTO "StoneEvent" ("id", "stoneId", "at", "type", "weightAfter", "refType", "refId", "summary")
SELECT 'evb_c_' || md5(p."id"), p."id", p."createdAt", 'CREATED',
       p."roughWeight", 'Lot', p."lotId",
       'Created' || COALESCE(' in lot ' || l."lotNumber", '')
FROM "Product" p LEFT JOIN "Lot" l ON l."id" = p."lotId"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StoneEvent" ("id", "stoneId", "at", "type", "partyId", "weightBefore", "refType", "refId", "summary", "data")
SELECT 'evb_i_' || md5(m."id"), m."productId", m."issueDate", 'ISSUE', m."partyId",
       ROUND(m."issueWeight"::numeric, 3), 'ProcessMovement', m."id",
       'Issued to ' || COALESCE(st."name", m."process"::text),
       jsonb_strip_nulls(jsonb_build_object('process', m."process", 'reissueReason', m."reissueReason", 'memoId', m."memoId"))
FROM "ProcessMovement" m LEFT JOIN "ProcessStage" st ON st."legacyProcess" = m."process"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StoneEvent" ("id", "stoneId", "at", "type", "partyId", "weightBefore", "weightAfter", "refType", "refId", "summary", "data")
SELECT 'evb_r_' || md5(m."id"), m."productId", m."returnDate", 'RETURN', m."partyId",
       ROUND(m."issueWeight"::numeric, 3), ROUND(m."returnWeight"::numeric, 3), 'ProcessMovement', m."id",
       'Returned from ' || COALESCE(st."name", m."process"::text),
       jsonb_strip_nulls(jsonb_build_object('process', m."process", 'topsWeight', m."topsWeight"))
FROM "ProcessMovement" m LEFT JOIN "ProcessStage" st ON st."legacyProcess" = m."process"
WHERE m."returnDate" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StoneEvent" ("id", "stoneId", "at", "type", "weightAfter", "refType", "refId", "summary")
SELECT 'evb_t_' || md5(s."id"), s."sourceProductId", s."createdAt", 'TRANSFER_TO_POLISH',
       ROUND(s."caratWeight"::numeric, 3), 'PolishedStone', s."id",
       'Transferred to Polish as ' || s."stockId"
FROM "PolishedStone" s
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StoneEvent" ("id", "stoneId", "at", "type", "partyId", "refType", "refId", "summary")
SELECT 'evb_s_' || md5(s."id"), s."sourceProductId", s."soldDate", 'SOLD', s."buyerId", 'PolishedStone', s."id", 'Sold'
FROM "PolishedStone" s
WHERE s."soldDate" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
