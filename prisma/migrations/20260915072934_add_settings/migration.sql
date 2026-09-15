-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "appName" TEXT NOT NULL DEFAULT 'Inventory Manager',
    "locations" TEXT NOT NULL DEFAULT 'Surat,Mumbai',
    "accentColor" TEXT NOT NULL DEFAULT '#18181b',
    "updatedAt" DATETIME NOT NULL
);
