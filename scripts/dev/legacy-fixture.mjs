// Loads production-shaped data using only the pre-ERP columns, so the ERP
// backfill migrations can be verified against realistic rows. Local dev DB
// only — refuses to touch anything that isn't localhost.
import pg from "pg";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL is not a localhost database.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const q = (sql, params = []) => client.query(sql, params);

await q(`INSERT INTO "User" (id, name, username, email, "passwordHash", role) VALUES
  ('u_admin', 'Admin', 'admin', 'admin@example.com', '$2b$10$kTtgjZp0s0WYb1uCqPq4LeQ7Lz2y0hY3Gk0m3VqkUq3nHfJb6N6pK', 'ADMIN'),
  ('u_staff', 'Old Staff', 'oldstaff', 'staff@example.com', '$2b$10$kTtgjZp0s0WYb1uCqPq4LeQ7Lz2y0hY3Gk0m3VqkUq3nHfJb6N6pK', 'STAFF')
  ON CONFLICT DO NOTHING`);

await q(`INSERT INTO "Party" (id, name, type, category) VALUES
  ('p_vendor', 'Legacy Tender Co', 'BOTH', 'TENDER_VENDOR'),
  ('p_kar1', 'Ramesh Bhai', 'BOTH', 'KARIGAR'),
  ('p_kar2', 'Suresh Laser', 'BOTH', NULL),
  ('p_cust', 'NY Buyer LLC', 'CUSTOMER', NULL)
  ON CONFLICT DO NOTHING`);

await q(`INSERT INTO "Lot" (id, "lotNumber", "roughWeight", "purchaseCost", "sourcePartyId", "createdAt") VALUES
  ('lot1', 'LOT-2026-001', 12.5, 250000, 'p_vendor', '2026-09-20')
  ON CONFLICT DO NOTHING`);

for (let i = 1; i <= 4; i++) {
  const sku = `LOT-2026-001-000${i}`;
  await q(
    `INSERT INTO "Product" (id, sku, name, stock, "lotId", "caratWeight", "createdAt", "updatedAt")
     VALUES ($1, $2, $2, 1, 'lot1', $3, '2026-09-20', now()) ON CONFLICT DO NOTHING`,
    [`prod${i}`, sku, [3.1, 2.4, 4.0, 3.0][i - 1]],
  );
}

await q(`INSERT INTO "Memo" (id, "memoNumber", process, date, "partyId") VALUES
  ('memo1', 'MEMO-00001', 'GREEN_SAWING', '2026-09-21', 'p_kar2'),
  ('memo2', 'MEMO-00002', 'BRUTING', '2026-09-25', 'p_kar1')
  ON CONFLICT DO NOTHING`);

// prod1: sawn and bruted, then polished and sold.
// prod2: currently out at Bruting with Ramesh.
// prod3: never issued. prod4: sawn, returned.
await q(`INSERT INTO "ProcessMovement" (id, process, "issueDate", "issueWeight", "returnDate", "returnWeight", "laborCost", "productId", "partyId", "memoId") VALUES
  ('mv1', 'GREEN_SAWING', '2026-09-21', 3.1, '2026-09-23', 2.9, 310, 'prod1', 'p_kar2', 'memo1'),
  ('mv2', 'BRUTING', '2026-09-25', 2.9, '2026-09-27', 2.55, 290, 'prod1', 'p_kar1', 'memo2'),
  ('mv3', 'BRUTING', '2026-09-25', 2.4, NULL, NULL, 240, 'prod2', 'p_kar1', 'memo2'),
  ('mv4', 'GREEN_SAWING', '2026-09-21', 3.0, '2026-09-23', 2.8, 300, 'prod4', 'p_kar2', 'memo1')
  ON CONFLICT DO NOTHING`);
await q(`UPDATE "Product" SET "currentProcess" = 'BRUTING', "currentPartyId" = 'p_kar1' WHERE id = 'prod2'`);
await q(`UPDATE "Product" SET "caratWeight" = 2.55 WHERE id = 'prod1'`);
await q(`UPDATE "Product" SET "caratWeight" = 2.8 WHERE id = 'prod4'`);

await q(`INSERT INTO "PolishedStone" (id, "stockId", "sourceProductId", shape, "caratWeight", color, clarity, status, "askingPrice", currency, "buyerId", "soldPrice", "soldDate", "paymentStatus", "roughCostAlloc", "laborCost", "createdAt") VALUES
  ('ps1', 'P-0001', 'prod1', 'Old Mine', 1.21, 'G', 'VS1', 'SOLD', 9000, 'USD', 'p_cust', 8500, '2026-09-30', 'PAID', 3100, 600, '2026-09-28')
  ON CONFLICT DO NOTHING`);

console.log("Legacy fixture loaded.");
await client.end();
