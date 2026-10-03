-- CreateTable
CREATE TABLE "PeriodLock" (
    "id" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedById" TEXT NOT NULL,
    "note" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "unlockedById" TEXT,
    "unlockReason" TEXT,

    CONSTRAINT "PeriodLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodLock_periodType_periodStart_key" ON "PeriodLock"("periodType", "periodStart");

-- CreateIndex
CREATE INDEX "Lot_createdAt_idx" ON "Lot"("createdAt");

-- CreateIndex
CREATE INDEX "PolishedStone_createdAt_idx" ON "PolishedStone"("createdAt");


-- Only days and months can be locked.
ALTER TABLE "PeriodLock" ADD CONSTRAINT "PeriodLock_type_valid" CHECK ("periodType" IN ('DAY', 'MONTH'));
