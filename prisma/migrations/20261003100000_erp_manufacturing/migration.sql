-- AlterTable
ALTER TABLE "Memo" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "stageId" TEXT,
ALTER COLUMN "process" DROP NOT NULL,
ALTER COLUMN "partyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProcessMovement" ADD COLUMN     "condition" TEXT,
ADD COLUMN     "excessReason" TEXT,
ADD COLUMN     "excessReviewNote" TEXT,
ADD COLUMN     "excessReviewedAt" TIMESTAMP(3),
ADD COLUMN     "excessReviewedById" TEXT,
ADD COLUMN     "fromDepartmentId" TEXT,
ADD COLUMN     "isExcessLoss" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "issuePieces" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "issuedById" TEXT,
ADD COLUMN     "lossLimitPct" DECIMAL(7,3),
ADD COLUMN     "lossPct" DECIMAL(7,3),
ADD COLUMN     "lossWeight" DECIMAL(12,3),
ADD COLUMN     "returnPieces" INTEGER,
ADD COLUMN     "returnRemark" TEXT,
ADD COLUMN     "returnedById" TEXT,
ADD COLUMN     "stageId" TEXT,
ADD COLUMN     "toDepartmentId" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT,
ALTER COLUMN "process" DROP NOT NULL;

-- CreateTable
CREATE TABLE "LossLimit" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "partyId" TEXT,
    "allowedPct" DECIMAL(7,3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LossLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breakage" (
    "id" TEXT NOT NULL,
    "stoneId" TEXT NOT NULL,
    "movementId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "weightBefore" DECIMAL(12,3) NOT NULL,
    "weightAfter" DECIMAL(12,3) NOT NULL,
    "totalLoss" BOOLEAN NOT NULL DEFAULT false,
    "handledByPartyId" TEXT,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Breakage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoneSplit" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "parentWeight" DECIMAL(12,3) NOT NULL,
    "childWeight" DECIMAL(12,3) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'WEIGHT',
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoneSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentData" (
    "attachmentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "thumb" BYTEA,

    CONSTRAINT "AttachmentData_pkey" PRIMARY KEY ("attachmentId")
);

-- CreateIndex
CREATE INDEX "LossLimit_stageId_partyId_effectiveFrom_idx" ON "LossLimit"("stageId", "partyId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Breakage_stoneId_idx" ON "Breakage"("stoneId");

-- CreateIndex
CREATE INDEX "Breakage_date_idx" ON "Breakage"("date");

-- CreateIndex
CREATE INDEX "Breakage_handledByPartyId_idx" ON "Breakage"("handledByPartyId");

-- CreateIndex
CREATE INDEX "StoneSplit_parentId_idx" ON "StoneSplit"("parentId");

-- CreateIndex
CREATE INDEX "ProcessMovement_stageId_idx" ON "ProcessMovement"("stageId");

-- CreateIndex
CREATE INDEX "ProcessMovement_issueDate_idx" ON "ProcessMovement"("issueDate");

-- CreateIndex
CREATE INDEX "ProcessMovement_returnDate_idx" ON "ProcessMovement"("returnDate");

-- CreateIndex
CREATE INDEX "ProcessMovement_isExcessLoss_idx" ON "ProcessMovement"("isExcessLoss");

-- CreateIndex
CREATE INDEX "ProcessMovement_toDepartmentId_idx" ON "ProcessMovement"("toDepartmentId");

-- AddForeignKey
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProcessStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_fromDepartmentId_fkey" FOREIGN KEY ("fromDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_excessReviewedById_fkey" FOREIGN KEY ("excessReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProcessStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LossLimit" ADD CONSTRAINT "LossLimit_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProcessStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LossLimit" ADD CONSTRAINT "LossLimit_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breakage" ADD CONSTRAINT "Breakage_stoneId_fkey" FOREIGN KEY ("stoneId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breakage" ADD CONSTRAINT "Breakage_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "ProcessMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breakage" ADD CONSTRAINT "Breakage_handledByPartyId_fkey" FOREIGN KEY ("handledByPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breakage" ADD CONSTRAINT "Breakage_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneSplit" ADD CONSTRAINT "StoneSplit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneSplit" ADD CONSTRAINT "StoneSplit_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
