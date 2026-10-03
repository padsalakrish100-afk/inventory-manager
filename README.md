# Inventory Manager — Opulent Diam ERP

Rough-to-sale manufacturing ERP for Opulent Diam (natural diamonds, antique and
specialty cuts; factory in Surat, company in the US). It tracks every stone from
rough purchase to final payment: lotting and planning, issue/return through the
factory with loss control, karigar labour and payroll, a per-stone cost ledger,
polished stock with grading and certificates, memos, invoices, payments,
receivables/payables, dashboards and reports.

- **For people using the app:** [docs/user-guide.md](docs/user-guide.md)
- **Backups and restore:** [docs/backup-restore.md](docs/backup-restore.md)
- **Developing and shipping changes:** [docs/development.md](docs/development.md)
- **Design notes / data model:** [docs/erp-plan.md](docs/erp-plan.md)

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind CSS 4 ·
Prisma 7 with `@prisma/adapter-pg` · Postgres on Neon · NextAuth v5
(username/password) · Vercel (deploys from GitHub) · optional Vercel Blob for
files · exceljs and @react-pdf for exports.

## Modules

| Area | What it does |
| --- | --- |
| Rough | Purchases with invoice and Kimberley Process files, assortment into packets, packet → lot |
| Lotting & planning | Lots and numbered stones, per-stone plans (Sarine/Galaxy files), planned vs actual |
| Manufacturing | Configurable stages, issue/return to karigars or departments, automatic loss, loss limits and excess-loss review, breakage, splits, pending report, QR labels and phone scanner, full stone timeline |
| Karigars | Profiles, rate cards with history, automatic labour, adjustments, payroll (paid/reversed), performance, outside job-work and bills |
| Costing | Cost ledger per stone (rough share, labour, job-work, certification, overhead, other) in USD and INR, allocation by weight, inventory value |
| Polished stock | Grading, antique-cut attributes, certificates (GIA/IGI/HRD) with verify links, photos/videos, location and status flow, Rapaport CSV and discount |
| Sales & finance | Memos (consignment), invoices with export fields and PDFs, receipts and payments, receivables/payables with ageing |
| Reports | Dashboard; stock list, aging, loss, yield, sales, profit, memo, receivables, payables, karigar performance, payroll — all filterable, Excel/PDF; RapNet CSV |
| System | Roles and cost hiding, audit log, period locking, full data export (zip of CSVs) |

## Roles

| Role | Can |
| --- | --- |
| Owner / Admin | Everything, including costs, profit, settings, users, voids, period locks |
| Manager | Operations, stock, memos, invoices, receipts; costs/profit only if "can see costs" is ticked on their user |
| Department operator | Issue/return in their own departments (scanner-first) |
| Viewer / Sales | Stock and memos; no costs |

Cost, profit and rough price are removed on the server — from pages, exports
and file downloads — for anyone who can't see costs.

## Running locally

Never point local development at production (`.env` holds the production
`DATABASE_URL`). Use the local database described in
[docs/development.md](docs/development.md):

```bash
npm install
npx prisma dev --name opulent-erp --detach   # local Postgres
# put the local URL in .env.local (see docs/development.md)
npx prisma migrate deploy
npm run db:seed        # first admin login (admin / admin123 — change it)
npm run db:seed:demo   # optional demo data and demo logins (local only)
npm run dev
```

## Environment variables

| Variable | Needed | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string (Neon in production) |
| `AUTH_SECRET` | yes | NextAuth session secret (random 32 bytes) |
| `BLOB_READ_WRITE_TOKEN` | recommended | Private Vercel Blob store for photos, videos, certificates; without it files are kept in the database (3 MB limit) |
| `APP_URL` | optional | Base URL printed in stone QR codes (defaults to the current site) |
| `GIA_REPORT_API_KEY` / `GIA_REPORT_API_URL` | optional | Enables "Check with GIA"; hidden when unset |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | optional | Credentials for `npm run db:seed` |

## Shipping changes

Every schema change is an additive Prisma migration (nothing that holds data is
dropped or renamed). Before merging a release: branch the Neon database,
`prisma migrate deploy` against production, then merge — Vercel builds and
deploys `main`. The full checklist is in
[docs/development.md](docs/development.md#shipping-a-phase-to-production).
