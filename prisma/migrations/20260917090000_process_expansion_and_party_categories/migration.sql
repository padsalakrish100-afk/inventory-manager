-- CreateEnum
CREATE TYPE "PartyCategory" AS ENUM ('TENDER_VENDOR', 'KARIGAR', 'CUSTOMER');

-- AlterTable: Party gets a workflow category (distinct from the older
-- `type` field) and an active/inactive flag — deactivated, never deleted,
-- since old parties stay linked to historical records.
ALTER TABLE "Party" ADD COLUMN "category" "PartyCategory";
ALTER TABLE "Party" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterEnum: expand the manufacturing process list to match the real
-- workflow — Galaxy, Planning, Laser Sawing, Bruting, Chabka, Polishing.
-- Renaming SAWING preserves any existing rows under the clearer name
-- rather than orphaning them; no row currently uses PLANNING or BRUTING
-- as data, so adding them here is safe in the same transaction.
ALTER TYPE "ProcessName" RENAME VALUE 'SAWING' TO 'LASER_SAWING';
ALTER TYPE "ProcessName" ADD VALUE 'PLANNING' BEFORE 'LASER_SAWING';
ALTER TYPE "ProcessName" ADD VALUE 'BRUTING' AFTER 'LASER_SAWING';

-- AlterTable: ProcessRate — extend the existing (disconnected) rate table
-- to also key off the current ProcessName enum, with effective-dating so
-- a rate change adds a new row instead of overwriting history. `stage`
-- (the old LotStatus-keyed column) is relaxed to nullable since new rows
-- populate `process` instead.
ALTER TABLE "ProcessRate" ALTER COLUMN "stage" DROP NOT NULL;
ALTER TABLE "ProcessRate" ADD COLUMN "process" "ProcessName";
ALTER TABLE "ProcessRate" ADD COLUMN "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ProcessRate_process_idx" ON "ProcessRate"("process");

-- AlterTable: ProcessMovement — a reason when re-issuing a stone to a
-- process it already completed once, and the labor cost actually charged
-- for this issue (auto-filled from the karigar's rate, editable, and
-- never retroactively changed by a later rate update).
ALTER TABLE "ProcessMovement" ADD COLUMN "reissueReason" TEXT;
ALTER TABLE "ProcessMovement" ADD COLUMN "laborCost" DOUBLE PRECISION;
