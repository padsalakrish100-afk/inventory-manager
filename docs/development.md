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

## File uploads (photos, PDFs)

Uploaded files are served only through `/api/attachments/[id]`, which checks
the viewer's permissions. Where the bytes live:

- **`BLOB_READ_WRITE_TOKEN` set** (Vercel → Storage → create a Blob store and
  connect it to the project): files go to a *private* Vercel Blob store.
- **Not set**: files are stored in the database (`AttachmentData`). Fine for
  local development and light use, but connect a Blob store before relying
  on photos in production.

Photos are resized/compressed in the browser before upload (≈1600 px JPEG
plus a 320 px thumbnail).

Stone videos: with a Blob store they upload straight from the phone to Blob
(up to 250 MB, via `/api/uploads/blob`); without one they're limited to
3 MB. Videos get a poster frame made in the browser and stream with Range
requests.

## Polished stock extras (Phase 5)

- **Rapaport:** upload the price list you get from your own Rapaport/RapNet
  subscription as CSV on Polish → Rap list. Nothing is fetched or scraped.
  The newest list (by effective date) is used for every "vs Rap" figure, so
  upload complete lists. `prisma/demo/rapaport-sample.csv` is an
  illustrative file with made-up numbers for local testing only.
- **GIA Report Check (optional):** set `GIA_REPORT_API_KEY` (and optionally
  `GIA_REPORT_API_URL`) to show a "Check with GIA" button on GIA-certified
  stones. Unset, the button is hidden everywhere. Not yet tested against the
  live API, since that needs a key from GIA.
- **Cut details:** Settings → Cut details defines the extra grading fields per
  cut style. Fields can be deactivated but never deleted, and values already
  saved on a stone are kept when a field is hidden.

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

## Sales, memos and payments (Phase 6)

- **Who can do what:** sales users can issue and return memos. Admins and managers can also invoice and record receipts. Payments out and payables need cost visibility (they show rough prices). Only an admin can void an invoice or a payment; voids are soft and logged in the audit log.
- **One source of truth:** stones go on memo and are sold only through memos and invoices. The old sale fields on a polished stone (buyer, sold price, payment status) are kept in step automatically, so older stock screens and reports still work.
- **Currencies:** a payment settles only documents in its own currency; anything over the amount owed is held on account. Every memo, invoice and payment stores its exchange rate (blank means the rate on file for the date).
- **Legacy sales:** the Phase 6 backfill turned each polished stone sold through the old sale form (with a buyer and price) into a `LEGACY-<stock id>` invoice, plus a receipt if it was marked paid. Stones marked "partly paid" got an invoice with a note asking for the received amount to be recorded.
- **Documents:** memo and invoice PDFs are served from `/api/documents/memo|invoice/<id>`. Company details, bank details, terms and the Kimberley Process warranty statement are set in Settings → Company & documents.
