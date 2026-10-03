# Development & deployment notes

## Never develop against production

`.env` holds the **production** Neon `DATABASE_URL`. Anything that changes the
schema (`prisma migrate dev`, `prisma db push`, `prisma migrate reset`) must
never run against it — `migrate dev` can offer to wipe the database if it
detects drift.

For local work, `.env.local` points at a local database instead. Next.js
loads `.env.local` over `.env`, so `npm run dev` uses the local database.
The Prisma CLI does **not** read `.env.local`, so pass the URL explicitly.

### Local database (no install needed)

```bash
npx prisma dev --name opulent-erp --detach      # local Postgres on :51214, shadow on :51215
```

`.env.local`:

```
DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
SHADOW_DATABASE_URL="postgres://postgres:postgres@localhost:51215/template1?sslmode=disable"
```

Then, with those two variables exported in your shell:

```bash
npx prisma migrate deploy        # apply all migrations
npm run db:seed                  # first admin login
npm run db:seed:demo             # demo users/lot/stones (refuses non-local DBs)
npm run dev
```

Demo logins (local only, password `demo1234`): `demo.admin`, `demo.manager`,
`demo.operator` (Sawing + Bruting departments), `demo.sales`.

To test a migration against production-shaped data, load the legacy fixture
first (pre-ERP columns only) and then apply the new migrations:

```bash
node scripts/dev/legacy-fixture.mjs     # localhost only
npx prisma migrate deploy
```

A Neon **branch** (copy-on-write clone of production) works the same way and
is the best rehearsal before touching production.

## Shipping a phase to production

All migrations are additive (new tables, new nullable/defaulted columns,
backfills that only write new columns), so the **old** app keeps working on
the **new** schema. That makes the safe order:

1. Neon console → create a branch of production (instant backup point).
2. Apply migrations to production:
   `DATABASE_URL=<prod url> npx prisma migrate deploy`
3. Merge / push to `main` → Vercel deploys the new code.

Never the other way round: new code on the old schema will fail at runtime.

## Conventions added in the ERP upgrade

- Every server action: `requirePermission(...)` → zod (`parseInput`) →
  `prisma.$transaction` → `writeAudit(tx, …)` (+ `recordStoneEvents` for
  anything that happens to a stone).
- Every page: `requirePagePermission(...)` as its first line; cost fields are
  only queried/rendered when `can(viewer, "costs.view")`.
- Weights: 3 decimals; money: 2 decimals; validated as decimal strings
  (`zCarat`, `zMoney`), never through floats.
- Dates are displayed in IST (`formatDate`, `formatDateTime`); date pickers
  are converted with `dateInputToInstant`.
- Forms use `useFormAction` (not bare `useActionState`) so a validation error
  doesn't wipe what the user typed.
