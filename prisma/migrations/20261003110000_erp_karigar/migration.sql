-- CreateEnum
CREATE TYPE "RateBasis" AS ENUM ('PER_CARAT', 'PER_PIECE', 'FIXED');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('ADVANCE', 'DEDUCTION', 'BONUS');

-- AlterTable
ALTER TABLE "ProcessMovement" ADD COLUMN     "jobWorkBillId" TEXT;

-- AlterTable
ALTER TABLE "ProcessRate" ADD COLUMN     "basis" "RateBasis" NOT NULL DEFAULT 'PER_CARAT',
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "processStageId" TEXT,
ADD COLUMN     "rate" DECIMAL(14,2),
ALTER COLUMN "ratePerCarat" DROP NOT NULL,
ALTER COLUMN "partyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "KarigarProfile" (
    "partyId" TEXT NOT NULL,
    "employeeCode" TEXT,
    "joiningDate" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KarigarProfile_pkey" PRIMARY KEY ("partyId")
);

-- CreateTable
CREATE TABLE "KarigarDepartment" (
    "partyId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "KarigarDepartment_pkey" PRIMARY KEY ("partyId","departmentId")
);

-- CreateTable
CREATE TABLE "LabourEntry" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "stageId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "basis" "RateBasis" NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "fxRate" DECIMAL(12,4),
    "source" TEXT NOT NULL,
    "rateCardId" TEXT,
    "note" TEXT,
    "payrollRunId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabourEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KarigarAdjustment" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "fxRate" DECIMAL(12,4),
    "note" TEXT,
    "payrollRunId" TEXT,
    "createdById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KarigarAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "labourTotal" DECIMAL(14,2) NOT NULL,
    "bonusTotal" DECIMAL(14,2) NOT NULL,
    "deductionTotal" DECIMAL(14,2) NOT NULL,
    "advanceTotal" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "fxRate" DECIMAL(12,4),
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT,
    "paymentRef" TEXT,
    "createdById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobWorkBill" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "fxRate" DECIMAL(12,4),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobWorkBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "date" DATE NOT NULL,
    "usdInr" DECIMAL(12,4) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE UNIQUE INDEX "KarigarProfile_employeeCode_key" ON "KarigarProfile"("employeeCode");

-- CreateIndex
CREATE INDEX "KarigarDepartment_departmentId_idx" ON "KarigarDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LabourEntry_movementId_key" ON "LabourEntry"("movementId");

-- CreateIndex
CREATE INDEX "LabourEntry_partyId_workDate_idx" ON "LabourEntry"("partyId", "workDate");

-- CreateIndex
CREATE INDEX "LabourEntry_payrollRunId_idx" ON "LabourEntry"("payrollRunId");

-- CreateIndex
CREATE INDEX "LabourEntry_workDate_idx" ON "LabourEntry"("workDate");

-- CreateIndex
CREATE INDEX "KarigarAdjustment_partyId_date_idx" ON "KarigarAdjustment"("partyId", "date");

-- CreateIndex
CREATE INDEX "PayrollRun_partyId_periodFrom_idx" ON "PayrollRun"("partyId", "periodFrom");

-- CreateIndex
CREATE INDEX "JobWorkBill_date_idx" ON "JobWorkBill"("date");

-- CreateIndex
CREATE UNIQUE INDEX "JobWorkBill_partyId_billNo_key" ON "JobWorkBill"("partyId", "billNo");

-- CreateIndex
CREATE INDEX "ProcessMovement_jobWorkBillId_idx" ON "ProcessMovement"("jobWorkBillId");

-- CreateIndex
CREATE INDEX "ProcessRate_processStageId_partyId_effectiveFrom_idx" ON "ProcessRate"("processStageId", "partyId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_jobWorkBillId_fkey" FOREIGN KEY ("jobWorkBillId") REFERENCES "JobWorkBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRate" ADD CONSTRAINT "ProcessRate_processStageId_fkey" FOREIGN KEY ("processStageId") REFERENCES "ProcessStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarProfile" ADD CONSTRAINT "KarigarProfile_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarDepartment" ADD CONSTRAINT "KarigarDepartment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarDepartment" ADD CONSTRAINT "KarigarDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourEntry" ADD CONSTRAINT "LabourEntry_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "ProcessMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourEntry" ADD CONSTRAINT "LabourEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourEntry" ADD CONSTRAINT "LabourEntry_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProcessStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourEntry" ADD CONSTRAINT "LabourEntry_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "ProcessRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourEntry" ADD CONSTRAINT "LabourEntry_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarAdjustment" ADD CONSTRAINT "KarigarAdjustment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarAdjustment" ADD CONSTRAINT "KarigarAdjustment_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobWorkBill" ADD CONSTRAINT "JobWorkBill_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
