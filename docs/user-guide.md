# User guide

A short guide to the daily work in Inventory Manager. Menus you don't see are
hidden by your role.

## Signing in and your home page

Sign in with your username and password. Owners, managers and sales staff land
on the **Dashboard** (this month's sales, receivables, stock value, memos,
pending work, alerts). Department operators land on the **Scanner**.
Change your password under your name (top right) → Account.

## Stone IDs, labels and the scanner

Every stone has an ID (e.g. `LOT-2026-001-0003`) and a QR label. Print labels
from **Stones → Labels** or a stone's page. On a phone, open **Scan**, point the
camera at the label, and the stone's page opens with its history and the quick
actions (issue, return, move).

## Rough to lots

1. **Rough → New purchase:** supplier, carats, pieces, price, currency and
   exchange rate, invoice number and file, Kimberley Process certificate.
2. Split the purchase into **packets** by size/quality; the packets must add up
   to the purchase (the page shows any difference).
3. **Allocate cost** to spread the purchase price over the packets.
4. **Put a packet into production** — it becomes a lot with numbered stones.

## Planning

On a stone's page → **Plan**: planned shape/cut, weight, colour, clarity,
expected value, and Sarine/Galaxy files. Mark the plan final.
**Reports → Planned vs actual** compares the plan with what was polished.

## Manufacturing

- **Issue:** Manufacturing → Issue (or scan). Pick the stage, the karigar or
  department, and scan or select stones. Weights are in carats (3 decimals).
- **Return:** Manufacturing → Return. Enter the return weight; loss is worked
  out automatically. If it's over the allowed loss, the line turns red and a
  reason is required — it then appears in **Excess-loss alerts** for review.
- **Breakage, splits:** from the stone's page. A split creates child stones
  that inherit their share of the cost.
- **Pending:** Manufacturing → Pending shows who has which stones and for how
  long; long-out stones are highlighted.
- **Undo:** only the latest entry of a stone can be undone (it's kept, marked
  void, in the history).

## Karigars

Karigars → profile, departments, photo. **Rates** sets per-piece, per-carat or
fixed rates per stage (with history). Labour is calculated on every return.
**Payroll** (cost viewers): choose the period, check advances and deductions,
mark as paid; a payroll can be reversed. **Performance** shows pieces, carats,
loss % and breakage per karigar. Outside factories are **Job-work**: issue to
them like a karigar and record their bill.

## Costs

Each stone has a cost ledger (on its page, for cost viewers): rough share,
labour, job-work, certification, overhead and other costs, in USD and INR.
**Costing** shows inventory value at cost and at asking price, and monthly
overhead.

## Polished stock

**Manufacturing → transfer to Polish** gives the stone a Stock ID (`P-0001`).
On **Polish**, open a stone to:
- enter grading, measurements and the cut-style details (Settings → Cut details
  defines these);
- add photos and videos (from the phone camera);
- record the certificate (lab, number, date, PDF) — the "Verify" link opens the
  lab's site;
- **Send to lab / Back from lab** (with the lab fee), **Move** between safe,
  factory and in transit;
- set asking and minimum price. Upload a Rapaport price list on **Polish → Rap
  list** to see the discount against Rap.

## Memos (consignment)

**Sales → Memos → New memo:** customer, due date, stones and prices. The memo
PDF has the consignment terms for signature. On the memo: tick stones and
**Mark returned**, or **Invoice selected**. Overdue memos are flagged on the
dashboard and the memos list.

## Invoices and payments

- **Sales → Invoices → New invoice:** customer, stones (from stock or from that
  customer's memo), prices, shipping/insurance, broker and brokerage %, and
  export details (incoterm, ports, carrier, AWB, KP number). Open the
  **Invoice PDF** to send it. Prices can't be edited later; an admin can void
  an invoice (with no payments) and you make a new one.
- **Record receipt:** from the invoice or Sales → Payments. Enter the amount and
  it's applied to the oldest open invoices of that customer (you can change the
  split); anything extra is held on account. Payments must be in the invoice's
  currency.
- **Payments out** (cost viewers): to vendors (rough), job-workers (bills) and
  brokers (brokerage).
- **Finance → Receivables / Payables** show what's owed with 0–30, 31–60, 61–90
  and 90+ day ageing.

## Reports

**Reports** lists every report you may see. Choose filters, press **Run
report**, then **Export Excel** or **Export PDF**. The **Stock list** report
also exports a **RapNet CSV** for trading platforms.

## Admin

- **Settings:** parties, process stages, departments, loss limits, exchange
  rates (fill in daily — every money entry stores the day's rate), cut details,
  company details printed on memos and invoices.
- **Users:** create logins, set roles, departments and "can see costs".
- **Audit log:** every change with who, when, and old → new values.
- **Period locks:** close a month (or day) once checked; entries dated in it
  can't be changed until unlocked.
- **Export all data:** a zip of every table as CSV. See
  [backup-restore.md](backup-restore.md) for backups.
