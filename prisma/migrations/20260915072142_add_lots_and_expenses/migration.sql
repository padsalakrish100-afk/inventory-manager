-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotNumber" TEXT NOT NULL,
    "roughWeight" REAL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ROUGH',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LotExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lotId" TEXT NOT NULL,
    CONSTRAINT "LotExpense_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "giaCertified" BOOLEAN NOT NULL DEFAULT false,
    "caratWeight" REAL,
    "color" TEXT,
    "clarity" TEXT,
    "cutGrade" TEXT,
    "costPrice" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "lotId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("caratWeight", "clarity", "color", "costPrice", "createdAt", "cutGrade", "giaCertified", "id", "location", "name", "reorderLevel", "sellingPrice", "sku", "stock", "unit", "updatedAt") SELECT "caratWeight", "clarity", "color", "costPrice", "createdAt", "cutGrade", "giaCertified", "id", "location", "name", "reorderLevel", "sellingPrice", "sku", "stock", "unit", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_lotId_idx" ON "Product"("lotId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Lot_lotNumber_key" ON "Lot"("lotNumber");

-- CreateIndex
CREATE INDEX "LotExpense_lotId_idx" ON "LotExpense"("lotId");
