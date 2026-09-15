-- CreateTable
CREATE TABLE "ProcessRate" (
    "id" TEXT NOT NULL,
    "stage" "LotStatus" NOT NULL,
    "ratePerCarat" DOUBLE PRECISION NOT NULL,
    "caratMin" DOUBLE PRECISION,
    "caratMax" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partyId" TEXT NOT NULL,

    CONSTRAINT "ProcessRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessRate_stage_idx" ON "ProcessRate"("stage");

-- CreateIndex
CREATE INDEX "ProcessRate_partyId_idx" ON "ProcessRate"("partyId");

-- AddForeignKey
ALTER TABLE "ProcessRate" ADD CONSTRAINT "ProcessRate_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
