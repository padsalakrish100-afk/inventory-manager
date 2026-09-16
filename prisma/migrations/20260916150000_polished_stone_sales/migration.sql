-- CreateEnum
CREATE TYPE "PolishStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ON_MEMO', 'SOLD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- AlterTable: sales tracking + cost components on PolishedStone
ALTER TABLE "PolishedStone" ADD COLUMN "status" "PolishStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "PolishedStone" ADD COLUMN "location" TEXT;
ALTER TABLE "PolishedStone" ADD COLUMN "askingPrice" DOUBLE PRECISION;
ALTER TABLE "PolishedStone" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "PolishedStone" ADD COLUMN "buyerId" TEXT;
ALTER TABLE "PolishedStone" ADD COLUMN "soldPrice" DOUBLE PRECISION;
ALTER TABLE "PolishedStone" ADD COLUMN "soldDate" TIMESTAMP(3);
ALTER TABLE "PolishedStone" ADD COLUMN "paymentStatus" "PaymentStatus";
ALTER TABLE "PolishedStone" ADD COLUMN "roughCostAlloc" DOUBLE PRECISION;
ALTER TABLE "PolishedStone" ADD COLUMN "laborCost" DOUBLE PRECISION;
ALTER TABLE "PolishedStone" ADD COLUMN "certCost" DOUBLE PRECISION;
ALTER TABLE "PolishedStone" ADD COLUMN "otherCost" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "PolishedStone_buyerId_idx" ON "PolishedStone"("buyerId");

-- CreateIndex
CREATE INDEX "PolishedStone_status_idx" ON "PolishedStone"("status");

-- AddForeignKey
ALTER TABLE "PolishedStone" ADD CONSTRAINT "PolishedStone_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
