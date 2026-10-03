-- CreateEnum
CREATE TYPE "StoneStatus" AS ENUM ('IN_PRODUCTION', 'POLISHED', 'AT_LAB', 'IN_STOCK', 'ON_MEMO', 'SOLD', 'RETURNED', 'SPLIT', 'BROKEN');

-- CreateEnum
CREATE TYPE "StoneLocation" AS ENUM ('FACTORY', 'OFFICE_SAFE', 'ON_MEMO', 'AT_LAB', 'IN_TRANSIT', 'SOLD');

-- CreateEnum
CREATE TYPE "PartyRoleType" AS ENUM ('VENDOR', 'KARIGAR', 'JOB_WORKER', 'CUSTOMER', 'BROKER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'MANAGER';
ALTER TYPE "Role" ADD VALUE 'OPERATOR';
ALTER TYPE "Role" ADD VALUE 'SALES';

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "creditCurrency" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(14,2),
ADD COLUMN     "roles" "PartyRoleType"[] DEFAULT ARRAY[]::"PartyRoleType"[],
ADD COLUMN     "taxIds" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "currentDepartmentId" TEXT,
ADD COLUMN     "currentStageId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "locationPartyId" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "roughWeight" DECIMAL(12,3),
ADD COLUMN     "status" "StoneStatus" NOT NULL DEFAULT 'IN_PRODUCTION',
ADD COLUMN     "stockLocation" "StoneLocation" NOT NULL DEFAULT 'FACTORY';

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "pendingAlertDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canSeeCosts" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDepartment" (
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "UserDepartment_pkey" PRIMARY KEY ("userId","departmentId")
);

-- CreateTable
CREATE TABLE "ProcessStage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "departmentId" TEXT,
    "legacyProcess" "ProcessName",
    "defaultLossLimitPct" DECIMAL(7,3),
    "isLabourBillable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoneEvent" (
    "id" TEXT NOT NULL,
    "stoneId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "partyId" TEXT,
    "weightBefore" DECIMAL(12,3),
    "weightAfter" DECIMAL(12,3),
    "refType" TEXT,
    "refId" TEXT,
    "summary" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoneEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "fileName" TEXT,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "UserDepartment_departmentId_idx" ON "UserDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessStage_code_key" ON "ProcessStage"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessStage_legacyProcess_key" ON "ProcessStage"("legacyProcess");

-- CreateIndex
CREATE INDEX "ProcessStage_departmentId_idx" ON "ProcessStage"("departmentId");

-- CreateIndex
CREATE INDEX "StoneEvent_stoneId_at_idx" ON "StoneEvent"("stoneId", "at");

-- CreateIndex
CREATE INDEX "StoneEvent_type_at_idx" ON "StoneEvent"("type", "at");

-- CreateIndex
CREATE INDEX "StoneEvent_refType_refId_idx" ON "StoneEvent"("refType", "refId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_userId_at_idx" ON "AuditLog"("userId", "at");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Party_roles_idx" ON "Party" USING GIN ("roles");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_stockLocation_idx" ON "Product"("stockLocation");

-- CreateIndex
CREATE INDEX "Product_parentId_idx" ON "Product"("parentId");

-- CreateIndex
CREATE INDEX "Product_currentStageId_idx" ON "Product"("currentStageId");

-- CreateIndex
CREATE INDEX "Product_currentDepartmentId_idx" ON "Product"("currentDepartmentId");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "ProcessStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_currentDepartmentId_fkey" FOREIGN KEY ("currentDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_locationPartyId_fkey" FOREIGN KEY ("locationPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartment" ADD CONSTRAINT "UserDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStage" ADD CONSTRAINT "ProcessStage_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneEvent" ADD CONSTRAINT "StoneEvent_stoneId_fkey" FOREIGN KEY ("stoneId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneEvent" ADD CONSTRAINT "StoneEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoneEvent" ADD CONSTRAINT "StoneEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
