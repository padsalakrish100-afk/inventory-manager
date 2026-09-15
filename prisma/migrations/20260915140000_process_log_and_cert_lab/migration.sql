-- AlterEnum
ALTER TYPE "LotStatus" ADD VALUE 'GALAXY' BEFORE 'SAWING';

-- CreateEnum
CREATE TYPE "CertificationLab" AS ENUM ('NONE', 'GIA', 'IGI');

-- AlterTable: add the new certification column, backfill from the old
-- boolean, then drop the boolean.
ALTER TABLE "Product" ADD COLUMN "certificationLab" "CertificationLab" NOT NULL DEFAULT 'NONE';
UPDATE "Product" SET "certificationLab" = 'GIA' WHERE "giaCertified" = true;
ALTER TABLE "Product" DROP COLUMN "giaCertified";

-- CreateTable
CREATE TABLE "ProcessLog" (
    "id" TEXT NOT NULL,
    "stage" "LotStatus" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "partyId" TEXT,

    CONSTRAINT "ProcessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessLog_productId_idx" ON "ProcessLog"("productId");

-- CreateIndex
CREATE INDEX "ProcessLog_partyId_idx" ON "ProcessLog"("partyId");

-- AddForeignKey
ALTER TABLE "ProcessLog" ADD CONSTRAINT "ProcessLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessLog" ADD CONSTRAINT "ProcessLog_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
