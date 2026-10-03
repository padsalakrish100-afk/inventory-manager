# Backups and restore

The database is the business record. There are three layers of protection, from
"undo a mistake from five minutes ago" to "keep a copy outside Neon".

## 1. Neon point-in-time restore (the main backup)

Neon keeps a continuous history of every change (its write-ahead log), so the
database can be brought back to **any moment** inside the history retention
window — not just to a nightly snapshot.

- **Retention:** set in the Neon console → your project → **Settings → Storage
  → History retention** (Neon calls it the restore window). The free plan keeps
  only about a day; paid plans allow 7 days or more. **Set it to at least 7 days**
  (30 if your plan allows) so a mistake found after a weekend can still be
  undone.
- Nothing needs to run for this to work — it is always on.

### Look at the past without touching production (safest first step)

1. Neon console → **Branches → Create branch**.
2. Parent: `main` (production). Choose **"Past data"** and pick the date and time
   just before the mistake.
3. Open the new branch's connection string and inspect the data (for example
   with `psql`, or by pointing a local copy of the app at it through
   `.env.local` — never edit `.env`).
4. If you only need a few records back, copy them over by hand or ask a
   developer to write a one-off script; then delete the branch.

### Roll the whole database back

Use this only when the damage is wide (for example a bad import) and everything
since that moment can be re-entered.

1. Tell everyone to stop using the app.
2. Neon console → **Branches → `main` → Restore** (Neon's "branch restore").
   Choose the timestamp just before the problem. Neon keeps the pre-restore state
   as a backup branch, so the restore itself can be undone.
3. Check the app (log in, open a few recent stones, memos and invoices).
4. Re-enter anything recorded after the restore point. The audit log on the
   backup branch shows exactly what that was.

The connection string does not change, so Vercel needs no changes.

## 2. Branch before every release

Before applying migrations for a new version (see
[development.md](development.md#shipping-a-phase-to-production)), create a Neon
branch of production named after the release (e.g. `before-phase-8`). It is an
instant, free copy you can return to if the release misbehaves. Delete old
release branches after a few weeks.

## 3. Your own copy: Export all data

**Settings → Export all data** downloads a zip with one CSV file per table
(stones, movements, costs, karigars, memos, invoices, payments, audit log, …).
It opens in Excel and is useful for an accountant, an audit, or a copy kept
outside Neon (save it to company storage monthly, e.g. after closing the month
in **Settings → Period locks**).

It is a copy for reading, not a one-click restore: user password hashes and the
bytes of uploaded files are left out. Uploaded files live in the Vercel Blob
store (or in the database when Blob isn't connected) and are covered by Neon /
Vercel respectively.

## Closing a month

Once a month's books are checked, lock it in **Settings → Period locks**. After
that nobody can add, change or void anything dated in that month until an admin
unlocks it with a reason (recorded in the audit log). Locking plus the monthly
export gives a fixed, reproducible record for each closed month.
