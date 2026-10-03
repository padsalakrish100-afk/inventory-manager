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

  const lotNumber = "DEMO-LOT-001";
  if (await prisma.lot.findUnique({ where: { lotNumber } })) {
    console.log("Demo lot already exists — users and parties ensured, nothing else to do.");
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
      stockId: `P-${String(stockNo).padStart(4, "0")}`, sourceProductId: stones[0].id, shape: "Old Mine Cut",
      caratWeight: 1.52, color: "H", clarity: "VS2", status: "AVAILABLE", askingPrice: 7800, currency: "USD",
    },
  });
  await prisma.product.update({ where: { id: stones[0].id }, data: { status: "IN_STOCK", stockLocation: "OFFICE_SAFE" } });
  await prisma.stoneEvent.create({
    data: { stoneId: stones[0].id, type: "TRANSFER_TO_POLISH", at: new Date("2026-10-01T12:00:00+05:30"), userId: adminId, weightBefore: "2.410", weightAfter: "1.520", refType: "PolishedStone", refId: polished.id, summary: `Transferred to Polish as ${polished.stockId}` },
  });

  console.log(`Demo data created: lot ${lotNumber} with ${stones.length} stones, parties, rates.`);
  console.log(`Demo logins (password "${DEMO_PASSWORD}"): ${DEMO_USERS.map((u) => u.username).join(", ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
