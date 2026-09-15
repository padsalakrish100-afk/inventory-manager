-- AlterEnum
ALTER TYPE "LotStatus" ADD VALUE 'CERTIFICATION';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "stage" "LotStatus" NOT NULL DEFAULT 'ROUGH';

-- AlterTable
ALTER TABLE "LotExpense" ADD COLUMN "ratePerCarat" DOUBLE PRECISION,
ADD COLUMN "caratMin" DOUBLE PRECISION,
ADD COLUMN "caratMax" DOUBLE PRECISION,
ADD COLUMN "partyId" TEXT;

-- CreateIndex
CREATE INDEX "LotExpense_partyId_idx" ON "LotExpense"("partyId");

-- AddForeignKey
ALTER TABLE "LotExpense" ADD CONSTRAINT "LotExpense_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
