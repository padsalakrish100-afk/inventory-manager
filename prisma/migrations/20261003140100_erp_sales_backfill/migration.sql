-- ERP Phase 6 backfill. Writes only to the new sales tables; the old sale
-- fields on "PolishedStone" are left exactly as they are.
--
-- A polished stone sold through the old sale form (status SOLD, with a
-- buyer and a sold price) gets a legacy invoice, so it shows up in
-- receivables and sales. If it was marked PAID it also gets a matching
-- legacy receipt. PARTIAL stones get an invoice with a note, since the
-- amount received was never recorded. Re-running is safe (fixed ids,
-- ON CONFLICT DO NOTHING).

WITH src AS (
  SELECT
    ps.id,
    ps."stockId",
    ps."buyerId",
    ps."sourceProductId",
    ps."paymentStatus",
    COALESCE(ps.currency, 'USD') AS currency,
    COALESCE(ps."soldDate", ps."createdAt") AS sold_at,
    ROUND(ps."soldPrice"::numeric, 2) AS amount,
    ROUND(COALESCE(ps."caratWeight", 0)::numeric, 3) AS carats,
    NULLIF(CONCAT_WS(' ', ps.shape, ps.color, ps.clarity, NULLIF(CONCAT_WS(' ', ps."certLab", ps."certNumber"), '')), '') AS description,
    (
      SELECT er."usdInr" FROM "ExchangeRate" er
      WHERE er.date <= COALESCE(ps."soldDate", ps."createdAt")::date
      ORDER BY er.date DESC LIMIT 1
    ) AS fx
  FROM "PolishedStone" ps
  WHERE ps.status = 'SOLD' AND ps."soldPrice" IS NOT NULL AND ps."soldPrice" > 0 AND ps."buyerId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "InvoiceLine" il WHERE il."stoneId" = ps."sourceProductId")
)
INSERT INTO "Invoice" (
  id, "invoiceNo", "partyId", date, "dueDate", currency, "fxRate", subtotal, total, "totalUsd", "totalInr",
  notes, "isLegacy", "createdAt", "hsCode"
)
SELECT
  'legacy_inv_' || src.id,
  'LEGACY-' || src."stockId",
  src."buyerId",
  src.sold_at,
  NULL,
  src.currency,
  src.fx,
  src.amount,
  src.amount,
  CASE WHEN src.currency = 'USD' THEN src.amount WHEN src.fx IS NOT NULL THEN ROUND(src.amount / src.fx, 2) END,
  CASE WHEN src.currency = 'INR' THEN src.amount WHEN src.fx IS NOT NULL THEN ROUND(src.amount * src.fx, 2) END,
  'Created from the stone''s earlier sale record.'
    || CASE WHEN src."paymentStatus" = 'PARTIAL' THEN ' It was marked partly paid; record what was received as a receipt.' ELSE '' END,
  true,
  NOW(),
  NULL
FROM src
ON CONFLICT DO NOTHING;

INSERT INTO "InvoiceLine" (id, "invoiceId", "stoneId", description, carats, "pricePerCt", amount, "costUsd")
SELECT
  'legacy_inl_' || ps.id,
  inv.id,
  ps."sourceProductId",
  NULLIF(CONCAT_WS(' ', ps.shape, ps.color, ps.clarity, NULLIF(CONCAT_WS(' ', ps."certLab", ps."certNumber"), '')), ''),
  ROUND(COALESCE(ps."caratWeight", 0)::numeric, 3),
  CASE WHEN COALESCE(ps."caratWeight", 0) > 0
    THEN ROUND(inv.total / ROUND(ps."caratWeight"::numeric, 3), 2)
    ELSE inv.total END,
  inv.total,
  NULL
FROM "PolishedStone" ps
JOIN "Invoice" inv ON inv.id = 'legacy_inv_' || ps.id
ON CONFLICT DO NOTHING;

INSERT INTO "Payment" (
  id, "paymentNo", direction, "partyId", date, amount, currency, "fxRate", "amountUsd", "amountInr",
  method, notes, "isLegacy", "createdAt"
)
SELECT
  'legacy_pay_' || ps.id,
  'LEGACY-' || ps."stockId",
  'IN',
  inv."partyId",
  inv.date,
  inv.total,
  inv.currency,
  inv."fxRate",
  inv."totalUsd",
  inv."totalInr",
  'Earlier record',
  'Marked paid on the stone before invoices existed.',
  true,
  NOW()
FROM "PolishedStone" ps
JOIN "Invoice" inv ON inv.id = 'legacy_inv_' || ps.id
WHERE ps."paymentStatus" = 'PAID'
ON CONFLICT DO NOTHING;

INSERT INTO "PaymentAllocation" (id, "paymentId", amount, "invoiceId", "createdAt")
SELECT 'legacy_alloc_' || p.id, p.id, p.amount, 'legacy_inv_' || SUBSTRING(p.id FROM 12), NOW()
FROM "Payment" p
WHERE p.id LIKE 'legacy_pay_%'
ON CONFLICT DO NOTHING;
