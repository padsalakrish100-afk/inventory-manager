-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('ROUGH', 'LABOUR', 'JOB_WORK', 'CERTIFICATION', 'OTHER', 'OVERHEAD');

-- AlterTable
ALTER TABLE "Lot" ADD COLUMN     "packetId" TEXT,
ADD COLUMN     "purchaseCurrency" TEXT,
ADD COLUMN     "purchaseFxRate" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "costAllocationMethod" TEXT NOT NULL DEFAULT 'WEIGHT';

-- CreateTable
CREATE TABLE "RoughPurchase" (
    "id" TEXT NOT NULL,
    "purchaseNo" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "totalCarats" DECIMAL(12,3) NOT NULL,
    "pieces" INTEGER NOT NULL,
    "pricePerCarat" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRate" DECIMAL(12,4),
    "invoiceNo" TEXT,
    "kpCertNo" TEXT,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "RoughPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoughPacket" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "packetCode" TEXT NOT NULL,
    "sizeRange" TEXT,
    "quality" TEXT,
    "model" TEXT,
    "carats" DECIMAL(12,3) NOT NULL,
    "pieces" INTEGER NOT NULL,
    "costShare" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoughPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StonePlan" (
    "id" TEXT NOT NULL,
    "stoneId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT true,
    "plannedShape" TEXT NOT NULL,
    "plannedCutStyle" TEXT,
    "plannedWeight" DECIMAL(12,3) NOT NULL,
    "expColor" TEXT,
    "expClarity" TEXT,
    "expCut" TEXT,
    "expectedValue" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StonePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostEntry" (
    "id" TEXT NOT NULL,
    "stoneId" TEXT NOT NULL,
    "type" "CostType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRate" DECIMAL(12,4),
    "amountUsd" DECIMAL(14,2),
    "amountInr" DECIMAL(14,2),
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "allocatedFromStoneId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "CostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverheadPool" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "fxRate" DECIMAL(12,4),
    "note" TEXT,
    "allocatedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "OverheadPool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoughPurchase_purchaseNo_key" ON "RoughPurchase"("purchaseNo");

-- CreateIndex
CREATE INDEX "RoughPurchase_partyId_date_idx" ON "RoughPurchase"("partyId", "date");

-- CreateIndex
CREATE INDEX "RoughPurchase_date_idx" ON "RoughPurchase"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RoughPacket_packetCode_key" ON "RoughPacket"("packetCode");

-- CreateIndex
CREATE INDEX "RoughPacket_purchaseId_idx" ON "RoughPacket"("purchaseId");

-- CreateIndex
CREATE INDEX "StonePlan_stoneId_isFinal_idx" ON "StonePlan"("stoneId", "isFinal");

-- CreateIndex
CREATE UNIQUE INDEX "StonePlan_stoneId_version_key" ON "StonePlan"("stoneId", "version");

-- CreateIndex
CREATE INDEX "CostEntry_stoneId_voidedAt_idx" ON "CostEntry"("stoneId", "voidedAt");

-- CreateIndex
CREATE INDEX "CostEntry_sourceType_sourceId_idx" ON "CostEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CostEntry_type_date_idx" ON "CostEntry"("type", "date");

-- CreateIndex
CREATE INDEX "OverheadPool_month_idx" ON "OverheadPool"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_packetId_key" ON "Lot"("packetId");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "RoughPacket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoughPurchase" ADD CONSTRAINT "RoughPurchase_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoughPacket" ADD CONSTRAINT "RoughPacket_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "RoughPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StonePlan" ADD CONSTRAINT "StonePlan_stoneId_fkey" FOREIGN KEY ("stoneId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEntry" ADD CONSTRAINT "CostEntry_stoneId_fkey" FOREIGN KEY ("stoneId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEntry" ADD CONSTRAINT "CostEntry_allocatedFromStoneId_fkey" FOREIGN KEY ("allocatedFromStoneId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

