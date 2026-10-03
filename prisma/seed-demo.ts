// Demo data for trying out the ERP phases locally. Every record it creates
// is prefixed DEMO / demo. so it's easy to tell apart. Safe to re-run.
//
//   npm run db:seed:demo
//
// Refuses to run against a non-local database unless
// ALLOW_DEMO_SEED_ON_REMOTE=1 is set — demo users must never end up in
// production by accident.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { parseRapCsv } from "../src/lib/rapaport";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ProcessName } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
if (!isLocal && process.env.ALLOW_DEMO_SEED_ON_REMOTE !== "1") {
  console.error("Refusing to seed demo data: DATABASE_URL is not a local database.");
  console.error("Set ALLOW_DEMO_SEED_ON_REMOTE=1 only for a throwaway branch database.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// Local demo logins (one per role). Change or delete them on the Users page.
const DEMO_PASSWORD = "demo1234";
const DEMO_USERS = [
  { username: "demo.admin", name: "Demo Owner", role: "ADMIN" as const, canSeeCosts: true, departments: [] as string[] },
  { username: "demo.manager", name: "Demo Manager", role: "MANAGER" as const, canSeeCosts: false, departments: [] },
  {
    username: "demo.operator",
    name: "Demo Sawing Operator",
    role: "OPERATOR" as const,
    canSeeCosts: false,
    departments: ["dept_sawing", "dept_bruting"],
  },
  { username: "demo.sales", name: "Demo Sales", role: "SALES" as const, canSeeCosts: false, departments: [] },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        name: u.name,
        email: `${u.username}@demo.local`,
        passwordHash,
        role: u.role,
        canSeeCosts: u.canSeeCosts,
        departments: { create: u.departments.map((departmentId) => ({ departmentId })) },
      },
    });
    users[u.username] = user.id;
  }
  const adminId = users["demo.admin"];

  const party = (name: string, roles: ("VENDOR" | "KARIGAR" | "JOB_WORKER" | "CUSTOMER" | "BROKER")[], extra = {}) =>
    prisma.party.upsert({
      where: { name },
      update: {},
      create: {
        name,
        roles,
        category: roles.includes("VENDOR") ? "TENDER_VENDOR" : roles.includes("CUSTOMER") ? "CUSTOMER" : "KARIGAR",
        ...extra,
      },
    });

  const vendor = await party("DEMO Antwerp Rough Tender", ["VENDOR"], { country: "Belgium" });
  const sawyer = await party("DEMO Mahesh Laser Works", ["KARIGAR"], { phone: "+91 98250 00001" });
  const bruter = await party("DEMO Kiran Bruting", ["KARIGAR"], { phone: "+91 98250 00002" });
  await party("DEMO Old Mine Polishers (outside)", ["JOB_WORKER"], { country: "India" });
  await party("DEMO NYC Antique Jewels LLC", ["CUSTOMER"], { country: "USA", creditLimit: "50000.00", creditCurrency: "USD" });
  await party("DEMO Ravi Broker", ["BROKER"]);

  for (const [p, process, rate] of [
    [sawyer, "GREEN_SAWING", 120],
    [bruter, "BRUTING", 90],
  ] as const) {
    const exists = await prisma.processRate.findFirst({ where: { partyId: p.id, process } });
    if (!exists) {
      await prisma.processRate.create({
        data: { partyId: p.id, process, ratePerCarat: rate, effectiveFrom: new Date("2026-01-01") },
      });
    }
  }

  // Phase 2: example loss limits (only where none is set yet).
  for (const [code, pct] of [
    ["GREEN_SAWING", "8"],
    ["QUAZER_SAWING", "8"],
    ["BRUTING", "10"],
    ["POLISHING", "45"],
  ] as const) {
    await prisma.processStage.updateMany({ where: { code, defaultLossLimitPct: null }, data: { defaultLossLimitPct: pct } });
  }
  const bruteStage = await prisma.processStage.findUnique({ where: { code: "BRUTING" } });
  if (bruteStage && !(await prisma.lossLimit.findFirst({ where: { stageId: bruteStage.id, partyId: bruter.id } }))) {
    await prisma.lossLimit.create({
      data: { stageId: bruteStage.id, partyId: bruter.id, allowedPct: "12", effectiveFrom: new Date("2026-01-01") },
    });
  }

  // Phase 3: an exchange rate, stage default rates, karigar profiles.
  if ((await prisma.exchangeRate.count()) === 0) {
    await prisma.exchangeRate.create({ data: { date: new Date("2026-09-01T00:00:00Z"), usdInr: "88.2500" } });
  }
  for (const [code, basis, rate] of [
    ["MARKING", "PER_PIECE", "15.00"],
    ["BLOCKING", "PER_CARAT", "80.00"],
    ["POLISHING", "PER_CARAT", "250.00"],
    ["BRUTING", "PER_CARAT", "85.00"],
  ] as const) {
    const stage = await prisma.processStage.findUnique({ where: { code } });
    if (stage && !(await prisma.processRate.findFirst({ where: { processStageId: stage.id, partyId: null } }))) {
      await prisma.processRate.create({
        data: {
          processStageId: stage.id,
          process: stage.legacyProcess,
          basis,
          rate,
          currency: "INR",
          ratePerCarat: basis === "PER_CARAT" ? Number(rate) : null,
          effectiveFrom: new Date("2026-01-01"),
        },
      });
    }
  }
  // The karigar rates above are written the old way (process + per-carat);
  // give them their stage and rate-card fields like the Phase 3 backfill.
  await prisma.$executeRaw`
    UPDATE "ProcessRate" r SET "processStageId" = s."id", "basis" = 'PER_CARAT', "rate" = ROUND(r."ratePerCarat"::numeric, 2)
    FROM "ProcessStage" s
    WHERE r."processStageId" IS NULL AND r."process" IS NOT NULL AND s."legacyProcess" = r."process"`;
  for (const k of [sawyer, bruter]) {
    await prisma.karigarProfile.upsert({ where: { partyId: k.id }, create: { partyId: k.id, joiningDate: new Date("2024-04-01") }, update: {} });
  }
  for (const [k, dept] of [
    [sawyer, "dept_sawing"],
    [bruter, "dept_bruting"],
  ] as const) {
    await prisma.karigarDepartment.upsert({
      where: { partyId_departmentId: { partyId: k.id, departmentId: dept } },
      create: { partyId: k.id, departmentId: dept },
      update: {},
    });
  }

  // Phase 4: a rough purchase with its assortment (allocate cost and lot the
  // packets from the purchase page).
  if (!(await prisma.roughPurchase.findUnique({ where: { purchaseNo: "RP-DEMO-001" } }))) {
    const adminForSeed = users["demo.admin"];
    await prisma.roughPurchase.create({
      data: {
        purchaseNo: "RP-DEMO-001",
        partyId: vendor.id,
        date: new Date("2026-09-15T12:00:00+05:30"),
        source: "Antwerp tender Sept-26",
        totalCarats: "42.500",
        pieces: 18,
        pricePerCarat: "1200.00",
        totalAmount: "51000.00",
        currency: "USD",
        fxRate: "88.2500",
        invoiceNo: "INV-ATW-7781",
        kpCertNo: "BE-2026-KP-004512",
        createdById: adminForSeed,
        packets: {
          create: [
            { packetCode: "RP-DEMO-001-A", sizeRange: "2-4 ct", quality: "Clivage", model: "Old Mine makeable", carats: "24.300", pieces: 8 },
            { packetCode: "RP-DEMO-001-B", sizeRange: "1-2 ct", quality: "Sawable", model: "Rose cut", carats: "18.100", pieces: 10 },
          ],
        },
      },
    });
  }

  // Phase 5: an illustrative Rap list (made-up numbers, not real Rapaport
  // prices) so "vs Rap" has something to compare against.
  if ((await prisma.rapaportList.count()) === 0) {
    const csv = Papa.parse<string[]>(readFileSync(new URL("./demo/rapaport-sample.csv", import.meta.url), "utf8"), { skipEmptyLines: true });
    const rap = parseRapCsv(csv.data);
    const list = await prisma.rapaportList.create({
      data: { effectiveDate: new Date("2026-10-02T00:00:00Z"), fileName: "DEMO rapaport-sample.csv", rowCount: rap.rows.length, uploadedById: adminId },
    });
    await prisma.rapaportPrice.createMany({ data: rap.rows.map((r) => ({ ...r, listId: list.id })) });
  }

  const lotNumber = "DEMO-LOT-001";
  if (await prisma.lot.findUnique({ where: { lotNumber } })) {
    await backfillDemoMovements();
    console.log("Demo lot already exists — users, parties, and limits ensured.");
    return;
  }

  const lottedAt = new Date("2026-09-23T15:00:00+05:30");
  const lot = await prisma.lot.create({
    data: { lotNumber, createdAt: lottedAt, roughWeight: 18.5, purchaseCost: 92500, sourcePartyId: vendor.id, description: "Demo rough lot" },
  });
  const weights = [3.21, 2.875, 4.05, 2.4, 3.1, 2.865];
  const stones = [];
  for (const [i, w] of weights.entries()) {
    const sku = `${lotNumber}-${String(i + 1).padStart(4, "0")}`;
    const stone = await prisma.product.create({
      data: { sku, name: sku, stock: 1, lotId: lot.id, caratWeight: w, roughWeight: w.toFixed(3), createdAt: lottedAt },
    });
    await prisma.stoneEvent.create({
      data: { stoneId: stone.id, type: "CREATED", at: lottedAt, userId: adminId, weightAfter: w.toFixed(3), refType: "Lot", refId: lot.id, summary: `Created in lot ${lotNumber}` },
    });
    stones.push(stone);
  }

  const stage = async (process: ProcessName) => prisma.processStage.findUniqueOrThrow({ where: { legacyProcess: process } });
  const sawing = await stage("GREEN_SAWING");
  const bruting = await stage("BRUTING");

  const memoCounter = async () =>
    `MEMO-${String((await prisma.counter.upsert({ where: { key: "MEMO" }, create: { key: "MEMO", value: 1 }, update: { value: { increment: 1 } } })).value).padStart(5, "0")}`;

  // Stones 1–3: sawn and returned. Stones 1–2 then went to bruting; stone 1
  // came back, stone 2 is still out (pending). Stone 4 is out at sawing.
  const sawMemo = await prisma.memo.create({
    data: { memoNumber: await memoCounter(), process: "GREEN_SAWING", partyId: sawyer.id, date: new Date("2026-09-24T10:00:00+05:30") },
  });
  const sawReturns = [2.98, 2.66, 3.71];
  for (const [i, stone] of stones.slice(0, 3).entries()) {
    const issueDate = new Date("2026-09-24T10:00:00+05:30");
    const returnDate = new Date("2026-09-26T17:00:00+05:30");
    const m = await prisma.processMovement.create({
      data: {
        productId: stone.id, process: "GREEN_SAWING", partyId: sawyer.id, memoId: sawMemo.id,
        issueDate, issueWeight: weights[i], returnDate, returnWeight: sawReturns[i],
        laborCost: Math.round(weights[i] * 120 * 100) / 100,
      },
    });
    await prisma.product.update({ where: { id: stone.id }, data: { caratWeight: sawReturns[i] } });
    await prisma.stoneEvent.createMany({
      data: [
        { stoneId: stone.id, type: "ISSUE", at: issueDate, userId: adminId, partyId: sawyer.id, weightBefore: weights[i].toFixed(3), refType: "ProcessMovement", refId: m.id, summary: `Issued to Green Sawing — ${sawyer.name}` },
        { stoneId: stone.id, type: "RETURN", at: returnDate, userId: adminId, partyId: sawyer.id, weightBefore: weights[i].toFixed(3), weightAfter: sawReturns[i].toFixed(3), refType: "ProcessMovement", refId: m.id, summary: `Returned from Green Sawing — ${sawyer.name}` },
      ],
    });
  }

  const bruteMemo = await prisma.memo.create({
    data: { memoNumber: await memoCounter(), process: "BRUTING", partyId: bruter.id, date: new Date("2026-09-27T11:00:00+05:30") },
  });
  for (const [i, stone] of stones.slice(0, 2).entries()) {
    const issueDate = new Date("2026-09-27T11:00:00+05:30");
    const returned = i === 0;
    const returnDate = new Date("2026-09-29T16:00:00+05:30");
    const returnWeight = 2.41;
    const m = await prisma.processMovement.create({
      data: {
        productId: stone.id, process: "BRUTING", partyId: bruter.id, memoId: bruteMemo.id,
        issueDate, issueWeight: sawReturns[i], laborCost: Math.round(sawReturns[i] * 90 * 100) / 100,
        ...(returned ? { returnDate, returnWeight } : {}),
      },
    });
    await prisma.product.update({
      where: { id: stone.id },
      data: returned
        ? { caratWeight: returnWeight }
        : { currentProcess: "BRUTING", currentPartyId: bruter.id, currentStageId: bruting.id, currentDepartmentId: bruting.departmentId },
    });
    await prisma.stoneEvent.create({
      data: { stoneId: stone.id, type: "ISSUE", at: issueDate, userId: adminId, partyId: bruter.id, weightBefore: sawReturns[i].toFixed(3), refType: "ProcessMovement", refId: m.id, summary: `Issued to Bruting — ${bruter.name}` },
    });
    if (returned) {
      await prisma.stoneEvent.create({
        data: { stoneId: stone.id, type: "RETURN", at: returnDate, userId: adminId, partyId: bruter.id, weightBefore: sawReturns[i].toFixed(3), weightAfter: returnWeight.toFixed(3), refType: "ProcessMovement", refId: m.id, summary: `Returned from Bruting — ${bruter.name}` },
      });
    }
  }

  const sawMemo2 = await prisma.memo.create({
    data: { memoNumber: await memoCounter(), process: "GREEN_SAWING", partyId: sawyer.id, date: new Date("2026-09-20T09:30:00+05:30") },
  });
  const m4 = await prisma.processMovement.create({
    data: {
      productId: stones[3].id, process: "GREEN_SAWING", partyId: sawyer.id, memoId: sawMemo2.id,
      issueDate: new Date("2026-09-20T09:30:00+05:30"), issueWeight: weights[3], laborCost: Math.round(weights[3] * 120 * 100) / 100,
    },
  });
  await prisma.product.update({
    where: { id: stones[3].id },
    data: { currentProcess: "GREEN_SAWING", currentPartyId: sawyer.id, currentStageId: sawing.id, currentDepartmentId: sawing.departmentId },
  });
  await prisma.stoneEvent.create({
    data: { stoneId: stones[3].id, type: "ISSUE", at: new Date("2026-09-20T09:30:00+05:30"), userId: adminId, partyId: sawyer.id, weightBefore: weights[3].toFixed(3), refType: "ProcessMovement", refId: m4.id, summary: `Issued to Green Sawing — ${sawyer.name}` },
  });

  // Stone 1 finished: transferred to Polish as an Old Mine cut.
  const stockNo = (await prisma.counter.upsert({ where: { key: "STOCK" }, create: { key: "STOCK", value: 1 }, update: { value: { increment: 1 } } })).value;
  const polished = await prisma.polishedStone.create({
    data: {
      stockId: `P-${String(stockNo).padStart(4, "0")}`, sourceProductId: stones[0].id, shape: "Cushion", cutStyle: "OLD_MINE",
      caratWeight: 1.52, color: "H", clarity: "VS2", status: "AVAILABLE", askingPrice: 7800, minPrice: "7000.00", currency: "USD",
      polishGrade: "Good", symmetry: "Good", fluorescence: "None", lengthMm: "6.95", widthMm: "6.60", depthMm: "4.62",
      tablePct: "48.0", depthPct: "70.0", girdle: "Thin to Medium", culet: "Large",
      certified: true, certLab: "GIA", certNumber: "DEMO2215543", certDate: new Date("2026-09-28T12:00:00+05:30"),
      attributes: { crown_height: "High", culet_size: "Large", open_culet: true, outline: "Squarish" },
    },
  });
  await prisma.product.update({ where: { id: stones[0].id }, data: { status: "IN_STOCK", stockLocation: "OFFICE_SAFE" } });
  await prisma.stoneEvent.create({
    data: { stoneId: stones[0].id, type: "TRANSFER_TO_POLISH", at: new Date("2026-10-01T12:00:00+05:30"), userId: adminId, weightBefore: "2.410", weightAfter: "1.520", refType: "PolishedStone", refId: polished.id, summary: `Transferred to Polish as ${polished.stockId}` },
  });

  await backfillDemoMovements();
  console.log(`Demo data created: lot ${lotNumber} with ${stones.length} stones, parties, rates.`);
  console.log(`Demo logins (password "${DEMO_PASSWORD}"): ${DEMO_USERS.map((u) => u.username).join(", ")}`);
}

// Movements above are written the pre-ERP way (process only); give them
// their stage and loss the same way the Phase 2 backfill migration does.
async function backfillDemoMovements() {
  await prisma.$executeRaw`
    UPDATE "ProcessMovement" m SET "stageId" = s."id"
    FROM "ProcessStage" s
    WHERE m."stageId" IS NULL AND m."process" IS NOT NULL AND s."legacyProcess" = m."process"`;
  await prisma.$executeRaw`
    UPDATE "Memo" mo SET "stageId" = s."id"
    FROM "ProcessStage" s
    WHERE mo."stageId" IS NULL AND mo."process" IS NOT NULL AND s."legacyProcess" = mo."process"`;
  await prisma.$executeRaw`
    UPDATE "ProcessMovement" SET
      "lossWeight" = ROUND(("issueWeight" - "returnWeight" - COALESCE("topsWeight", 0))::numeric, 3),
      "lossPct" = CASE WHEN "issueWeight" > 0
        THEN ROUND((("issueWeight" - "returnWeight" - COALESCE("topsWeight", 0)) / "issueWeight" * 100)::numeric, 3) END
    WHERE "lossWeight" IS NULL AND "returnDate" IS NOT NULL AND "issueWeight" IS NOT NULL AND "returnWeight" IS NOT NULL`;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
