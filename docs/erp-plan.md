# Opulent Diam ERP: upgrade plan

Status: **proposal, awaiting approval**. Nothing in the code or database has been changed.

---

## 1. Current schema (as read on 2026-10-03, HEAD `5933c1d`)

| Model | What it really is today | Notes |
|---|---|---|
| `Lot` | A rough lot. `lotNumber` (`LOT-2026-001`), `roughWeight`, `purchaseCost`, `sourceParty` | Money/weight are `Float`. No currency. |
| `Product` | **The stone.** `sku` = `LOT-2026-001-0001`, `caratWeight` (current weight), `lotId`, `currentProcess` + `currentPartyId` (where it is now) | The name is a leftover from the original generic stock app. Also has legacy `stage`, `stock`, `costPrice`, `sellingPrice`. |
| `ProcessMovement` | One issue→return cycle: `process` (enum), `partyId`, `issueWeight`, `returnWeight`, `topsWeight`, `laborCost` (set **at issue** from the rate), `reissueReason`, `memoId` | Loss is never stored; it is computed in reports. `undoMovement` **hard-deletes** these rows. |
| `Memo` | The **manufacturing issue voucher** (`MEMO-00001`), one per Issue action | Its name collides with sales memo/consignment. |
| `PolishedStone` | 1:1 with `Product` once polished. `stockId` `P-0001`, basic grading, `certLab`/`certNumber`, plus sale fields: `status` (AVAILABLE/RESERVED/ON_MEMO/SOLD), `location` (free text), `askingPrice`, `currency`, `buyerId`, `soldPrice`, `soldDate`, `paymentStatus`, and cost fields `roughCostAlloc/laborCost/certCost/otherCost` | All `Float`. `undoTransfer` hard-deletes it. |
| `Party` | `name` (unique), legacy `type`, a single `category` (TENDER_VENDOR/KARIGAR/CUSTOMER), `active`, phone/email/address/notes | Free-text party names are auto-created via `upsert` by name. |
| `ProcessRate` | Per karigar × process: `ratePerCarat`, `effectiveFrom` (history kept), legacy `stage` | Per-carat only. |
| `ProcessName` enum | GALAXY, PLANNING, GREEN_SAWING, QUAZER_SAWING, WATERJET_SAWING, BRUTING, CHABKA, POLISHING | Hardcoded. |
| `User` | `role` ADMIN / STAFF, login lockout | |
| `Setting` | singleton: appName, locations (CSV string), accentColor | |
| Legacy, not written by any current page | `Transaction`, `ProcessLog`, `LotExpense`, `Product.stage`, `ProcessRate.stage` | Leave untouched. |

**Auth and security today:** NextAuth v5 credentials + JWT, and `src/proxy.ts` (Next 16's middleware) requires login. Only the Parties and Users actions check for `ADMIN`. Every other server action, plus `/api/export/[report]` and `/api/stones/*`, only checks that the user is logged in, so any STAFF user can read and edit costs today. There is no zod (it is in `node_modules` only as a transitive dependency), no audit log and no soft delete.

**Small existing bugs found along the way:**
- `proxy.ts` redirects a logged-in user who opens `/login` to `/dashboard`, which doesn't exist (404).
- Actions revalidate `/manufacturing/tracking`, which also doesn't exist.
- Memo and Stock IDs come from `count() + 1`. That races under concurrent use and collides after a delete.
- README still describes the SQLite setup.

---

## 2. Design principles

1. **`Product` stays the stone table.** Renaming a table that holds data is off-limits and isn't needed. In the UI it's called "Stone". New code uses a `src/lib/stone/*` layer, so the old name stays inside Prisma calls only.
2. **One stone record for the whole life.** Status and location live on the stone (`Product`), so a rough stone, a polished stone and a sold stone are the same ID. `PolishedStone` stays the grading/certificate extension.
3. **Enum → table without breaking data.** New `ProcessStage` table, plus a nullable `stageId` on `ProcessMovement`, backfilled from the old `process` enum. The enum column stays, written in parallel during the transition, and is never dropped.
4. **Ledgers, not overwrites.** Cost, labour, payments and stone events are append-only rows. A correction is a reversing row or a `voidedAt`, never a delete.
5. **One server-side gate per write:** `defineAction({ schema: zod, permission, audit, periodCheck })`. It does auth → role → zod parse → period lock → runs inside a transaction → writes the audit row.
6. **Money:** `Decimal(14,2)` for amounts, `Decimal(12,3)` for carats, `Decimal(12,4)` for fx rates and `Decimal(7,3)` for percentages. Every money row stores `currency` + `fxRate` (INR per 1 USD) and a frozen `amountUsd` + `amountInr`. The reporting base currency is **USD** (US entity) and INR is shown alongside.
7. **Field-level hiding happens in DTO mappers,** not in the UI. `toStoneDTO(stone, viewer)` strips cost, profit and rough price unless `viewer.canSeeCosts`. Pages and API routes only return DTOs.

---

## 3. Proposed data model (Prisma sketch, key fields only)

Legend: 🆕 new model · ➕ new columns on an existing model (all nullable or defaulted, so additive)

### 3.1 Phase 1: Foundation

```prisma
// ➕ Role enum: ADD VALUE only (ADMIN, STAFF kept)
enum Role { ADMIN STAFF MANAGER OPERATOR SALES }   // ADMIN = Owner/Admin

model User {                     // ➕
  canSeeCosts  Boolean  @default(false)   // lets a MANAGER see cost/profit
  active       Boolean  @default(true)
  departments  UserDepartment[]
}

enum PartyRoleType { VENDOR KARIGAR JOB_WORKER CUSTOMER BROKER }

model Party {                    // ➕ (category/type kept, backfilled into roles)
  roles          PartyRoleType[]          // Postgres enum array
  companyName    String?
  contactPerson  String?
  country        String?  @default("IN")
  taxIds         Json?                     // {gstin, pan, ein, iec, ...}
  creditLimit    Decimal? @db.Decimal(14,2)
  creditCurrency String?  @default("USD")
  karigar        KarigarProfile?
  @@index([roles], type: Gin)
}

model Department {               // 🆕 e.g. Planning, Sawing, Bruting, Polishing, QC, Office
  id String @id @default(cuid())
  name String @unique
  sortOrder Int @default(0)
  active Boolean @default(true)
  stages ProcessStage[]
  users  UserDepartment[]
}

model UserDepartment {           // 🆕 scopes OPERATOR users
  userId String; departmentId String
  @@id([userId, departmentId])
}

model ProcessStage {             // 🆕 admin-editable, replaces the hardcoded enum
  id String @id @default(cuid())
  code String @unique            // "BRUTING"; matches the legacy enum value where one exists
  name String
  sortOrder Int
  departmentId String?
  legacyProcess ProcessName?     // mapping used for the backfill
  defaultLossLimitPct Decimal? @db.Decimal(7,3)
  isLabourBillable Boolean @default(true)
  active Boolean @default(true)
}

enum StoneStatus { IN_PRODUCTION POLISHED AT_LAB IN_STOCK ON_MEMO SOLD RETURNED SPLIT BROKEN }
enum StoneLocation { FACTORY OFFICE_SAFE ON_MEMO AT_LAB IN_TRANSIT SOLD }

model Product {                  // ➕ (= Stone)
  parentId       String?                    // split: parent → children
  parent         Product?  @relation("StoneSplit", fields: [parentId], references: [id])
  children       Product[] @relation("StoneSplit")
  status         StoneStatus   @default(IN_PRODUCTION)
  location       StoneLocation @default(FACTORY)
  locationPartyId String?                   // memo party / lab / transit carrier
  currentStageId String?                    // replaces currentProcess going forward
  currentDepartmentId String?
  roughWeight    Decimal? @db.Decimal(12,3) // weight at lotting (frozen; yield base)
  deletedAt      DateTime?
  @@index([status]) @@index([location]) @@index([parentId]) @@index([currentStageId])
}

model StoneEvent {               // 🆕 the timeline, append-only
  id String @id @default(cuid())
  stoneId String
  at DateTime @default(now())
  type String                    // ISSUE, RETURN, LOSS_FLAG, BREAKAGE, SPLIT, STATUS, LOCATION, COST, MEMO_OUT, SOLD, ...
  userId String?
  partyId String?
  weightBefore Decimal? @db.Decimal(12,3)
  weightAfter  Decimal? @db.Decimal(12,3)
  refType String?  refId String?            // link to movement / invoice / cost entry
  data Json?
  @@index([stoneId, at])
}

model AuditLog {                 // 🆕
  id String @id @default(cuid())
  at DateTime @default(now())
  userId String?
  action String                  // CREATE | UPDATE | DELETE | VOID | UNLOCK | EXPORT
  entity String
  entityId String
  before Json?
  after Json?
  @@index([entity, entityId]) @@index([at]) @@index([userId])
}

model Counter {                  // 🆕 race-safe document numbers (MEMO, P-, INV, SM, RP...)
  key String @id
  value Int
}

model Attachment {               // 🆕 one polymorphic table for every file
  id String @id @default(cuid())
  entityType String              // ROUGH_PURCHASE, KP, PLAN, BREAKAGE, CERT, STONE_MEDIA, KARIGAR_PHOTO ...
  entityId String
  kind String                    // INVOICE, KP_CERT, SARINE, IMAGE, VIDEO, PDF ...
  url String
  thumbUrl String?
  mime String
  sizeBytes Int
  uploadedById String?
  createdAt DateTime @default(now())
  deletedAt DateTime?
  @@index([entityType, entityId])
}
```

### 3.2 Phase 2: Manufacturing core

```prisma
model ProcessMovement {          // ➕
  stageId          String?               // backfilled from `process`
  fromDepartmentId String?
  toDepartmentId   String?               // issue to a department with no karigar
  issuedById       String?
  returnedById     String?
  issuePieces      Int?     @default(1)
  returnPieces     Int?
  condition        String?               // OK / CHIPPED / BROKEN / ...
  lossWeight       Decimal? @db.Decimal(12,3)
  lossPct          Decimal? @db.Decimal(7,3)
  lossLimitPct     Decimal? @db.Decimal(7,3)  // snapshot of the limit applied
  isExcessLoss     Boolean  @default(false)
  excessReason     String?
  excessReviewedById String?  excessReviewedAt DateTime?
  voidedAt DateTime?  voidedById String?  voidReason String?   // replaces hard delete
  @@index([stageId]) @@index([returnDate]) @@index([isExcessLoss]) @@index([issueDate])
}

model LossLimit {                // 🆕 most specific match wins: stage+karigar > stage
  id String @id @default(cuid())
  stageId String
  partyId String?
  allowedPct Decimal @db.Decimal(7,3)
  effectiveFrom DateTime @default(now())
  @@index([stageId, partyId, effectiveFrom])
}

model Breakage {                 // 🆕 photos via Attachment
  id String @id @default(cuid())
  stoneId String
  movementId String?
  date DateTime
  reason String
  weightBefore Decimal @db.Decimal(12,3)
  weightAfter  Decimal @db.Decimal(12,3)
  handledByPartyId String?
  recordedById String
  notes String?
}

model StoneSplit {               // 🆕 one event per split, children carry parentId
  id String @id @default(cuid())
  parentId String
  date DateTime
  parentWeight Decimal @db.Decimal(12,3)
  method String @default("WEIGHT")      // cost inheritance basis
  recordedById String
}

// Setting ➕ pendingAlertDays Int @default(7), defaultCurrency, fxRateDefault ...
```

### 3.3 Phase 3: Karigar and labour

```prisma
model KarigarProfile {           // 🆕 1:1 with Party(role KARIGAR); photo via Attachment
  partyId String @id
  joiningDate DateTime?
  departments Department[]        // implicit m:n
  employeeCode String? @unique
}

enum RateBasis { PER_CARAT PER_PIECE FIXED }

model ProcessRate {              // ➕ becomes the rate card (old rows kept as PER_CARAT)
  stageId  String?
  basis    RateBasis @default(PER_CARAT)
  rate     Decimal?  @db.Decimal(14,2)    // backfilled from ratePerCarat
  currency String    @default("INR")
  // partyId relaxed to NULLABLE: a null party = the default rate for the stage
}

model LabourEntry {              // 🆕 one per completed return
  id String @id @default(cuid())
  movementId String @unique
  partyId String
  stageId String
  workDate DateTime
  basis RateBasis
  rate Decimal @db.Decimal(14,2)
  quantity Decimal @db.Decimal(12,3)     // carats or pieces
  amount Decimal @db.Decimal(14,2)
  currency String @default("INR")
  fxRate Decimal @db.Decimal(12,4)
  rateId String?                          // null = manual / legacy
  payrollRunId String?
  voidedAt DateTime?
  @@index([partyId, workDate])
}

model KarigarAdjustment {        // 🆕 advances, deductions, bonuses
  id String @id @default(cuid())
  partyId String; date DateTime
  type String                    // ADVANCE | DEDUCTION | BONUS
  amount Decimal @db.Decimal(14,2); currency String @default("INR")
  note String?; payrollRunId String?
}

model PayrollRun {               // 🆕 one per karigar per period
  id String @id @default(cuid())
  partyId String
  periodFrom DateTime; periodTo DateTime
  gross Decimal @db.Decimal(14,2); adjustments Decimal @db.Decimal(14,2); net Decimal @db.Decimal(14,2)
  status String @default("DRAFT")        // DRAFT | FINALISED | PAID
  paidAt DateTime?; paymentId String?
}

model JobWorkBill {              // 🆕 outside factory bill, feeds payables + cost ledger
  id String @id @default(cuid())
  partyId String; billNo String; date DateTime
  amount Decimal @db.Decimal(14,2); currency String; fxRate Decimal @db.Decimal(12,4)
  movements ProcessMovement[]             // ➕ ProcessMovement.jobWorkBillId
  deletedAt DateTime?
}
```

### 3.4 Phase 4: Rough purchase, planning and costing

```prisma
model RoughPurchase {            // 🆕 invoice + KP files via Attachment
  id String @id @default(cuid())
  purchaseNo String @unique               // RP-2026-001
  partyId String
  date DateTime
  source String?                          // tender name / source
  totalCarats Decimal @db.Decimal(12,3)
  pieces Int
  pricePerCarat Decimal @db.Decimal(14,2)
  totalAmount Decimal @db.Decimal(14,2)
  currency String; fxRate Decimal @db.Decimal(12,4)
  invoiceNo String?
  kpCertNo String?                        // required before the purchase can be lotted
  dueDate DateTime?                       // payables
  packets RoughPacket[]
  deletedAt DateTime?
}

model RoughPacket {              // 🆕 assortment
  id String @id @default(cuid())
  purchaseId String
  packetCode String @unique               // RP-2026-001-A
  sizeRange String?; quality String?; model String?
  carats Decimal @db.Decimal(12,3)
  pieces Int
  costShare Decimal? @db.Decimal(14,2)    // computed by weight (or manual override)
  lot Lot?                                // ➕ Lot.packetId @unique: "Lot this packet"
}

model StonePlan {                // 🆕 Sarine/Galaxy files via Attachment
  id String @id @default(cuid())
  stoneId String
  version Int @default(1)
  isFinal Boolean @default(true)
  plannedShape String; plannedCutStyle String?
  plannedWeight Decimal @db.Decimal(12,3)
  expColor String?; expClarity String?; expCut String?
  expectedValue Decimal? @db.Decimal(14,2); currency String @default("USD")
  createdById String; createdAt DateTime @default(now())
}

enum CostType { ROUGH LABOUR JOB_WORK CERTIFICATION OTHER OVERHEAD }

model CostEntry {                // 🆕 the cost ledger
  id String @id @default(cuid())
  stoneId String
  type CostType
  date DateTime
  amount Decimal @db.Decimal(14,2); currency String; fxRate Decimal @db.Decimal(12,4)
  amountUsd Decimal @db.Decimal(14,2); amountInr Decimal @db.Decimal(14,2)
  sourceType String?  sourceId String?    // RoughPurchase / LabourEntry / JobWorkBill / Split / LEGACY
  allocatedFromStoneId String?            // split inheritance
  note String?
  voidedAt DateTime?
  @@index([stoneId]) @@index([type, date])
}

model OverheadPool {             // 🆕 monthly overhead, allocated by carats processed
  id String @id @default(cuid())
  month DateTime; amount Decimal @db.Decimal(14,2); currency String; fxRate Decimal @db.Decimal(12,4)
  basis String @default("CARATS_RETURNED"); allocatedAt DateTime?
}

model ExchangeRate {             // 🆕 daily default USD→INR (always editable per entry)
  date DateTime @id @db.Date
  usdInr Decimal @db.Decimal(12,4)
}
```

### 3.5 Phase 5: Polished stock

```prisma
model PolishedStone {            // ➕ (existing fields kept)
  cutStyle String?                         // OLD_MINE, OLD_EUROPEAN, ROSE, STEP, PORTRAIT, OTHER
  lengthMm Decimal? @db.Decimal(6,2); widthMm Decimal? @db.Decimal(6,2); depthMm Decimal? @db.Decimal(6,2)
  tablePct Decimal? @db.Decimal(5,2); depthPct Decimal? @db.Decimal(5,2)
  girdle String?; culet String?
  crownAngle Decimal? @db.Decimal(5,2); crownHeight Decimal? @db.Decimal(5,2)
  pavilionAngle Decimal? @db.Decimal(5,2); pavilionDepth Decimal? @db.Decimal(5,2)
  attributes Json?                         // antique-cut key/values, driven by AttributeDefinition
  certDate DateTime?
  minPrice Decimal? @db.Decimal(14,2)
  askingPricePerCt Decimal? @db.Decimal(14,2)
  @@index([shape]) @@index([cutStyle]) @@index([certNumber])
}

model AttributeDefinition {      // 🆕 add antique-cut fields with no migration
  id String @id @default(cuid())
  cutStyle String?                         // null = applies to all cuts
  key String; label String
  type String                              // TEXT | NUMBER | SELECT | BOOLEAN
  options String[]
  sortOrder Int @default(0); active Boolean @default(true)
  @@unique([cutStyle, key])
}

model RapaportList {             // 🆕 your CSV upload only
  id String @id @default(cuid())
  effectiveDate DateTime; uploadedById String; createdAt DateTime @default(now())
  rows RapaportPrice[]
}
model RapaportPrice {
  listId String; shapeGroup String         // ROUND | PEAR
  caratFrom Decimal @db.Decimal(6,2); caratTo Decimal @db.Decimal(6,2)
  color String; clarity String
  pricePerCt Decimal @db.Decimal(12,2)     // USD hundreds × 100
  @@index([listId, shapeGroup, color, clarity])
}
// Location history = StoneEvent rows of type LOCATION / STATUS.
```

### 3.6 Phase 6: Sales, memo and payments

```prisma
model SalesMemo {                // 🆕 consignment (separate from the manufacturing Memo)
  id String @id @default(cuid())
  memoNo String @unique                    // SM-2026-0001
  partyId String; date DateTime; dueDate DateTime; terms String?
  currency String; fxRate Decimal @db.Decimal(12,4)
  status String @default("OPEN")           // OPEN | PARTIAL | CLOSED
  lines SalesMemoLine[]
  deletedAt DateTime?
}
model SalesMemoLine {
  id String @id @default(cuid())
  memoId String; stoneId String
  carats Decimal @db.Decimal(12,3); pricePerCt Decimal @db.Decimal(14,2); amount Decimal @db.Decimal(14,2)
  status String @default("OUT")            // OUT | RETURNED | SOLD
  returnedAt DateTime?; invoiceLineId String?
}

model Invoice {                  // 🆕
  id String @id @default(cuid())
  invoiceNo String @unique; partyId String; date DateTime; dueDate DateTime?
  currency String; fxRate Decimal @db.Decimal(12,4)
  brokerId String?; brokeragePct Decimal? @db.Decimal(7,3)
  shipping Decimal? @db.Decimal(14,2); insurance Decimal? @db.Decimal(14,2)
  // export fields
  shipToName String?; shipToAddress String?; shipToCountry String?
  incoterm String?; hsCode String? @default("7102.39"); portOfLoading String?
  awbNo String?; carrier String?; kpCertNo String?
  subtotal Decimal @db.Decimal(14,2); total Decimal @db.Decimal(14,2)
  isLegacy Boolean @default(false)         // created from old PolishedStone sale fields
  lines InvoiceLine[]
  deletedAt DateTime?
  @@index([partyId, date])
}
model InvoiceLine {
  id String @id @default(cuid())
  invoiceId String; stoneId String
  carats Decimal @db.Decimal(12,3); pricePerCt Decimal @db.Decimal(14,2); amount Decimal @db.Decimal(14,2)
  costUsd Decimal? @db.Decimal(14,2)       // cost snapshot at sale time, for profit
}

model Payment {                  // 🆕 receipts AND payables
  id String @id @default(cuid())
  direction String                         // IN (receipt) | OUT (payment)
  partyId String; date DateTime
  amount Decimal @db.Decimal(14,2); currency String; fxRate Decimal @db.Decimal(12,4)
  method String?; reference String?
  allocations PaymentAllocation[]
  deletedAt DateTime?
}
model PaymentAllocation {        // one of the targets is set
  id String @id @default(cuid())
  paymentId String; amount Decimal @db.Decimal(14,2)
  invoiceId String?; roughPurchaseId String?; jobWorkBillId String?; payrollRunId String?
}
```

### 3.7 Phase 8: Hardening

```prisma
model PeriodLock {               // 🆕
  id String @id @default(cuid())
  periodType String              // DAY | MONTH
  periodStart DateTime @db.Date
  lockedAt DateTime; lockedById String
  unlockedAt DateTime?; unlockedById String?; unlockReason String?
  @@unique([periodType, periodStart])
}
```

---

## 4. Page and route map

**New** = 🆕 · **Extended** = ➕ · unmarked = unchanged

```
/                         → /dashboard
/dashboard 🆕             stage counts, pending, excess loss, overdue memos, stock value, month sales/profit, receivables
/scan 🆕                  camera scanner (BarcodeDetector + zxing fallback) → /stones/[id]
/stones 🆕                paginated stone list (all statuses), filters, bulk label print
/stones/[id] 🆕           STONE HUB: header, quick actions (Issue / Return / Move / Breakage / Split), timeline, plan, cost tab (cost viewers only)
/stones/[id]/split 🆕
/stones/labels?ids= 🆕    sticker sheet (QR + Code128), 50×25 mm default

/rough 🆕                 purchases list
/rough/new 🆕             purchase + invoice + KP upload
/rough/[id] 🆕            assortment packets, difference vs purchase, "Lot this packet" → /lotting/new?packet=
/lotting ➕               (shows the linked packet/purchase)

/planning 🆕              stones awaiting a plan
/planning/[stoneId] 🆕    plan versions + Sarine/Galaxy files

/manufacturing ➕         landing
/manufacturing/issue ➕   stage (from table), to karigar OR department, pieces
/manufacturing/return ➕  auto loss, red flag + mandatory reason, condition, pieces
/manufacturing/pending 🆕 by karigar/department, days out, highlight > N days
/manufacturing/alerts 🆕  excess-loss list (review/acknowledge)
/manufacturing/breakage 🆕
/manufacturing/memo/[id]  (renamed in UI: "Issue voucher")
/manufacturing/stone/[id] → redirects to /stones/[id] (old links/barcodes keep working)

/karigars 🆕              karigar master (Party with KARIGAR role)
/karigars/[id] 🆕         profile, photo, departments, rate cards + history, performance
/karigars/payroll 🆕      date range → runs, advances/deductions, mark paid, Excel/PDF
/job-work 🆕              outside job-workers: open issues, bills

/polish ➕                becomes "Stock": filters (status, location, shape, cut style, cert)
/polish/[id] ➕           grading, antique attributes, cert (+GIA check if key set), media, location, pricing vs Rap
/polish/rapaport 🆕       CSV upload

/sales/memos 🆕 /new /[id] /[id]/print
/sales/invoices 🆕 /new /[id] /[id]/print
/sales/payments 🆕 /new
/finance/receivables 🆕   per invoice, per party, ageing 0-30/31-60/61-90/90+
/finance/payables 🆕      rough purchases, job-work bills, payroll

/reports 🆕               index; aging, loss, yield (+planned vs actual), karigar, payroll,
                          sales, profit, stock list, memo, receivables, payables
/api/export/[report] ➕   every report → xlsx/pdf, role-filtered columns
/api/export/rapnet 🆕     RapNet-style CSV
/api/upload 🆕            Vercel Blob client-upload token (role-checked)
/api/stones/[sku] ➕      DTO-filtered

/settings/parties ➕      multi-role, company, country, tax IDs, credit limit
/settings/stages 🆕       process stages + default loss %
/settings/departments 🆕
/settings/loss-limits 🆕
/settings/attributes 🆕   antique-cut attribute definitions
/settings/fx 🆕           daily USD/INR
/settings/general 🆕      pending days, label size, cost allocation method
/admin/audit 🆕           searchable audit log
/admin/locks 🆕           close/unlock day or month
/admin/export 🆕          zip of CSVs per table
/users ➕                 new roles, canSeeCosts, departments
```

**New dependencies:** `zod` (made explicit), `qrcode`, `@zxing/browser`, `@vercel/blob`, `sharp` (thumbnails), `jszip` and `decimal.js` (already bundled with Prisma).

---

## 5. Phases (as specified, with backfills noted)

| # | Phase | Data backfill in that phase |
|---|---|---|
| 1 | Foundation: roles, permissions, `defineAction`, audit log, Party roles, Department, ProcessStage, stone status/location/parent, StoneEvent, Counter, Attachment, QR labels, `/scan`, `/stones/[id]` | Party.roles ← category/type. ProcessStage rows ← existing enum. Product.status ← PolishedStone.status (or IN_PRODUCTION). Product.roughWeight ← earliest issueWeight or caratWeight. StoneEvents ← existing movements and transfers. Counters ← current max numbers. |
| 2 | Manufacturing core | Movement.stageId ← process. lossWeight/lossPct computed for completed movements. `undoMovement` becomes void. |
| 3 | Karigar module | ProcessRate.rate/basis/stageId ← old. LabourEntry ← movements with `laborCost` (legacy, rate as recorded). |
| 4 | Rough, planning, costing | CostEntry ← PolishedStone cost fields (LEGACY), ← Lot.purchaseCost allocated by rough weight for lots without a purchase. |
| 5 | Polished stock | Location free text → enum (unknown text kept in a note). |
| 6 | Sales | Legacy invoice (+ payment if PAID) per PolishedStone with soldPrice/buyer. |
| 7 | Dashboard, reports, exports, RapNet CSV | — |
| 8 | Hardening: indexes, PeriodLock, data export, field-hiding security review, README/user guide, Neon PITR doc | — |

Each phase ends with a migration, `npm run build`, `tsc --noEmit` and lint, then a seed (`prisma/seed-demo.ts`, idempotent, only writes `DEMO-` records and refuses to run if `NODE_ENV=production` or if pointed at the prod host), a commit and a summary.

---

## 6. Risks to existing data and how each is handled

1. **🔴 Local `.env` points at the production Neon database.** `prisma migrate dev` against it would apply untested migrations to prod and, on any drift, offer to **reset (wipe) the database**. Mitigation: I only develop against a **Neon branch** (a copy-on-write clone of prod, free). Prod only ever receives `prisma migrate deploy` of reviewed migrations. You need to create the branch, or let me do it if the Neon CLI is logged in.
2. **Float → Decimal on existing columns** (`Lot.roughWeight/purchaseCost`, `Product.caratWeight`, `ProcessMovement.*Weight/laborCost`, `PolishedStone.*` money, `ProcessRate.ratePerCarat`). This is an in-place `ALTER COLUMN … TYPE numeric USING round(col::numeric, n)`. It drops nothing and renames nothing, but it does rewrite data, so it needs your approval (Q1).
3. **Postgres enum additions** (`Role`, `ProcessName`) can't be used in the same transaction they're added in, so they go in separate migrations.
4. **Hard deletes today** (`undoMovement`, `undoTransfer`, `deleteProcessRate`, `deleteLot`, `deleteStone`) become void/soft-delete, or stay allowed only when no financial record exists. Either way they're always audit-logged with a before snapshot.
5. **Role tightening:** current STAFF users can see costs today. After Phase 1 they can't, unless mapped to ADMIN or given `canSeeCosts` (Q3).
6. **Labour moves from issue-time to return-time** (per spec). Stones already out with a `laborCost` set at issue reuse that figure on return, so nothing is charged twice.
7. **Legacy currency unknown:** `Lot.purchaseCost`, `ProcessMovement.laborCost` and the PolishedStone cost fields have no currency recorded (Q2).
8. **Document numbering** moves to `Counter`, seeded from the current max, so existing numbers stay as they are.
9. **Vercel limits:** file uploads go client-direct to Blob (needs `BLOB_READ_WRITE_TOKEN`), and the full export is streamed and chunked to stay inside function time limits.
10. **Old barcodes keep scanning.** Labels already printed encode the SKU in Code128, and the new scanner accepts both those and the new QR codes.
