-- CreateEnum
CREATE TYPE "ProcessName" AS ENUM ('GALAXY', 'SAWING', 'CHABKA', 'POLISHING');

-- AlterTable: where a stone currently is (denormalized cache)
ALTER TABLE "Product" ADD COLUMN "currentProcess" "ProcessName";
ALTER TABLE "Product" ADD COLUMN "currentPartyId" TEXT;

-- AlterTable: who the rough in a lot was bought from
ALTER TABLE "Lot" ADD COLUMN "sourcePartyId" TEXT;

-- CreateTable
CREATE TABLE "Memo" (
    "id" TEXT NOT NULL,
    "memoNumber" TEXT NOT NULL,
    "process" "ProcessName" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partyId" TEXT NOT NULL,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessMovement" (
    "id" TEXT NOT NULL,
    "process" "ProcessName" NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueWeight" DOUBLE PRECISION,
    "returnDate" TIMESTAMP(3),
    "returnWeight" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "partyId" TEXT,
    "memoId" TEXT,

    CONSTRAINT "ProcessMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolishedStone" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "certLab" TEXT,
    "certNumber" TEXT,
    "shape" TEXT,
    "caratWeight" DOUBLE PRECISION,
    "color" TEXT,
    "clarity" TEXT,
    "cutGrade" TEXT,
    "polishGrade" TEXT,
    "symmetry" TEXT,
    "fluorescence" TEXT,
    "measurements" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceProductId" TEXT NOT NULL,

    CONSTRAINT "PolishedStone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Memo_memoNumber_key" ON "Memo"("memoNumber");
CREATE INDEX "Memo_partyId_idx" ON "Memo"("partyId");

CREATE INDEX "ProcessMovement_productId_idx" ON "ProcessMovement"("productId");
CREATE INDEX "ProcessMovement_partyId_idx" ON "ProcessMovement"("partyId");
CREATE INDEX "ProcessMovement_memoId_idx" ON "ProcessMovement"("memoId");

CREATE UNIQUE INDEX "PolishedStone_stockId_key" ON "PolishedStone"("stockId");
CREATE UNIQUE INDEX "PolishedStone_sourceProductId_key" ON "PolishedStone"("sourceProductId");

CREATE INDEX "Product_currentPartyId_idx" ON "Product"("currentPartyId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_currentPartyId_fkey" FOREIGN KEY ("currentPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_sourcePartyId_fkey" FOREIGN KEY ("sourcePartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcessMovement" ADD CONSTRAINT "ProcessMovement_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PolishedStone" ADD CONSTRAINT "PolishedStone_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
