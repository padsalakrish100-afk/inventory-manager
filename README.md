# Inventory Manager

A small internal web app for tracking stock levels and inward/outward
transactions, with login-based accounts for multiple staff.

Stack: Next.js (App Router) + TypeScript, Prisma, NextAuth (credentials
login), Tailwind CSS. Runs on SQLite locally; see **Deploying online**
below for switching to Postgres.

## Features

- Login with email/password (admin and staff roles)
- Products: SKU, name, unit, current stock, reorder level, location
  (e.g. Surat/Mumbai), GIA certification, carat/color/clarity/cut, and
  cost/selling price per unit
- Transactions: record stock in (purchases/returns) or stock out
  (sales/usage) against a product; stock is updated automatically and
  outward transactions can't exceed available stock
- Contacts: a reusable directory of suppliers/customers, linked to
  each transaction's party (typing a new name on a transaction saves
  it to the directory automatically)
- Lots: track a rough-to-polish manufacturing batch — every expense
  charged against it (rough purchase, sawing, cutting, polishing,
  certification, other), its current stage, and which product SKUs it
  produced, so you can see total cost in vs. current stock value out
- Dashboard: total products, total units in stock, low-stock alerts,
  stock value at cost/selling price, potential margin, recent activity
- Reports: Sales, Purchases, Stock summary, Lot costing, and Party
  ledger — each filterable (date range, product, party) and
  exportable to CSV; the party ledger drills into a party's full
  transaction history
- CSV export for products, transactions, lot expenses, and every
  report (the transactions export respects the current type/product/
  party filter)
- CSV import for products (Products → Import CSV): upload your whole
  stock list at once — new SKUs are created, existing SKUs are
  updated, bad rows are skipped with a reason instead of failing the
  whole file. Uses the same columns as the product export, so you can
  export your current stock as a starting template, edit it, and
  upload it back
- Users page (admin only): create/remove staff logins
- Settings page (admin only): change the app name, the location
  quick-picks, and the accent color without touching code — takes
  effect immediately, everywhere, including the sign-in page

## Local development

```bash
npm install
npm run db:seed   # creates the first admin login
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

Seeded admin login:

- Email: `admin@example.com`
- Password: `admin123`

**Change this immediately**: log in, go to Users, create your own
admin account, then remove the seeded one. Or re-seed with your own
credentials:

```bash
SEED_ADMIN_EMAIL=you@company.com SEED_ADMIN_PASSWORD=your-password npm run db:seed
```

Data is stored in `dev.db` (SQLite) at the project root, ignored by git.

### Adding/changing data models

Edit `prisma/schema.prisma`, then run:

```bash
npx prisma migrate dev --name <describe-the-change>
```

## Deploying online

SQLite won't work on serverless hosts like Vercel (no persistent
filesystem), so deploying means switching to a real Postgres database.
This is a one-time setup:

1. **Get a Postgres database.** Any provider works; two free options
   that pair well with Vercel are [Neon](https://neon.tech) and
   [Supabase](https://supabase.com). Create a project and copy its
   connection string (`postgresql://...`).

2. **Switch the Prisma datasource** in `prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```

3. **Swap the driver adapter.** Install the Postgres adapter:

   ```bash
   npm install @prisma/adapter-pg@7.10.0
   npm uninstall @prisma/adapter-better-sqlite3
   ```

   In `src/lib/prisma.ts` and `prisma/seed.ts`, replace the
   `PrismaBetterSqlite3` adapter with:

   ```ts
   import { PrismaPg } from "@prisma/adapter-pg";
   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
   ```

4. **Set environment variables** (in Vercel's project settings, or
   wherever you host):
   - `DATABASE_URL` — your Postgres connection string
   - `AUTH_SECRET` — a new random value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

5. **Run the migrations against the new database** (locally, pointed
   at the production `DATABASE_URL`, or via your host's build step):

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

6. **Deploy.** Push this repo to GitHub and import it in Vercel
   (or run `vercel` from the CLI), setting the two env vars above.
   Vercel auto-detects Next.js — no extra build config needed.

After that, share the app's URL with your team and create their
logins from the Users page.
