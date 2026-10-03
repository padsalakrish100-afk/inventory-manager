-- AlterTable
ALTER TABLE "PolishedStone" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "certDate" TIMESTAMP(3),
ADD COLUMN     "crownAngle" DECIMAL(5,2),
ADD COLUMN     "crownHeight" DECIMAL(5,2),
ADD COLUMN     "culet" TEXT,
ADD COLUMN     "cutStyle" TEXT,
ADD COLUMN     "depthMm" DECIMAL(6,2),
ADD COLUMN     "depthPct" DECIMAL(5,2),
ADD COLUMN     "girdle" TEXT,
ADD COLUMN     "lengthMm" DECIMAL(6,2),
ADD COLUMN     "minPrice" DECIMAL(14,2),
ADD COLUMN     "pavilionAngle" DECIMAL(5,2),
ADD COLUMN     "pavilionDepth" DECIMAL(5,2),
ADD COLUMN     "tablePct" DECIMAL(5,2),
ADD COLUMN     "widthMm" DECIMAL(6,2);

-- CreateTable
CREATE TABLE "AttributeDefinition" (
    "id" TEXT NOT NULL,
    "cutStyle" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapaportList" (
    "id" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapaportList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapaportPrice" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "shapeGroup" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "clarity" TEXT NOT NULL,
    "caratFrom" DECIMAL(6,2) NOT NULL,
    "caratTo" DECIMAL(6,2) NOT NULL,
    "pricePerCt" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "RapaportPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_cutStyle_key_key" ON "AttributeDefinition"("cutStyle", "key");

-- CreateIndex
CREATE INDEX "RapaportPrice_listId_shapeGroup_color_clarity_idx" ON "RapaportPrice"("listId", "shapeGroup", "color", "clarity");

-- CreateIndex
CREATE INDEX "PolishedStone_shape_idx" ON "PolishedStone"("shape");

-- CreateIndex
CREATE INDEX "PolishedStone_cutStyle_idx" ON "PolishedStone"("cutStyle");

-- CreateIndex
CREATE INDEX "PolishedStone_certNumber_idx" ON "PolishedStone"("certNumber");

-- AddForeignKey
ALTER TABLE "RapaportPrice" ADD CONSTRAINT "RapaportPrice_listId_fkey" FOREIGN KEY ("listId") REFERENCES "RapaportList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

