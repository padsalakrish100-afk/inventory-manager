-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('CERTIFIED_SINGLE', 'NON_CERTIFIED_SINGLE', 'LOOSE_PARCEL');

-- AlterTable
ALTER TABLE "PolishedStone" ADD COLUMN "saleType" "SaleType";
