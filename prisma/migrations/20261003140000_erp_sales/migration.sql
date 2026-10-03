-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "bankDetails" TEXT,
ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "companyEmail" TEXT,
ADD COLUMN     "companyName" TEXT NOT NULL DEFAULT 'Opulent Diam',
ADD COLUMN     "companyPhone" TEXT,
ADD COLUMN     "companyTaxInfo" TEXT,
ADD COLUMN     "invoiceDueDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "invoiceTerms" TEXT,
ADD COLUMN     "invoiceWarranty" TEXT,
ADD COLUMN     "memoDueDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "memoTerms" TEXT;

-- CreateTable
CREATE TABLE "SalesMemo" (
    "id" TEXT NOT NULL,
    "memoNo" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "terms" TEXT,
    "currency" TEXT NOT NULL,
    "fxRate" DECIMAL(12,4),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "SalesMemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesMemoLine" (
    "id" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "stoneId" TEXT NOT NULL,
    "carats" DECIMAL(12,3) NOT NULL,
    "pricePerCt" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OUT',
    "returnedAt" TIMESTAMP(3),
    "invoiceLineId" TEXT,

    CONSTRAINT "SalesMemoLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "fxRate" DECIMAL(12,4),
    "brokerId" TEXT,
    "brokeragePct" DECIMAL(7,3),
    "brokerageAmount" DECIMAL(14,2),
    "shipping" DECIMAL(14,2),
    "insurance" DECIMAL(14,2),
    "shipToName" TEXT,
    "shipToAddress" TEXT,
    "shipToCountry" TEXT,
    "incoterm" TEXT,
    "hsCode" TEXT DEFAULT '7102.39',
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "awbNo" TEXT,
    "carrier" TEXT,
    "kpCertNo" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "totalUsd" DECIMAL(14,2),
    "totalInr" DECIMAL(14,2),
    "notes" TEXT,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "stoneId" TEXT NOT NULL,
    "description" TEXT,
    "carats" DECIMAL(12,3) NOT NULL,
    "pricePerCt" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "costUsd" DECIMAL(14,2),

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRate" DECIMAL(12,4),
    "amountUsd" DECIMAL(14,2),
    "amountInr" DECIMAL(14,2),
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "invoiceId" TEXT,
    "roughPurchaseId" TEXT,
    "jobWorkBillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesMemo_memoNo_key" ON "SalesMemo"("memoNo");

-- CreateIndex
CREATE INDEX "SalesMemo_partyId_date_idx" ON "SalesMemo"("partyId", "date");

-- CreateIndex
CREATE INDEX "SalesMemo_status_dueDate_idx" ON "SalesMemo"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesMemoLine_invoiceLineId_key" ON "SalesMemoLine"("invoiceLineId");

-- CreateIndex
CREATE INDEX "SalesMemoLine_memoId_idx" ON "SalesMemoLine"("memoId");

-- CreateIndex
CREATE INDEX "SalesMemoLine_stoneId_status_idx" ON "SalesMemoLine"("stoneId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "Invoice_partyId_date_idx" ON "Invoice"("partyId", "date");

-- CreateIndex
CREATE INDEX "Invoice_date_idx" ON "Invoice"("date");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_stoneId_idx" ON "InvoiceLine"("stoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNo_key" ON "Payment"("paymentNo");

-- CreateIndex
CREATE INDEX "Payment_partyId_date_idx" ON "Payment"("partyId", "date");

-- CreateIndex
CREATE INDEX "Payment_direction_date_idx" ON "Payment"("direction", "date");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_roughPurchaseId_idx" ON "PaymentAllocation"("roughPurchaseId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_jobWorkBillId_idx" ON "PaymentAllocation"("jobWorkBillId");

-- AddForeignKey
ALTER TABLE "SalesMemo" ADD CONSTRAINT "SalesMemo_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesMemoLine" ADD CONSTRAINT "SalesMemoLine_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "SalesMemo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesMemoLine" ADD CONSTRAINT "SalesMemoLine_stoneId_fkey" FOREIGN KEY ("stoneId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesMemoLine" ADD CONSTRAINT "SalesMemoLine_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_stoneId_fkey" FOREIGN KEY ("stoneId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_roughPurchaseId_fkey" FOREIGN KEY ("roughPurchaseId") REFERENCES "RoughPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_jobWorkBillId_fkey" FOREIGN KEY ("jobWorkBillId") REFERENCES "JobWorkBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Each allocation settles exactly one document, for a positive amount.
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_one_target"
  CHECK (num_nonnulls("invoiceId", "roughPurchaseId", "jobWorkBillId") = 1);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_direction_valid" CHECK ("direction" IN ('IN', 'OUT'));
