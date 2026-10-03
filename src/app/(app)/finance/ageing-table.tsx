import Link from "next/link";
import { daysSince, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { AGEING_BUCKETS, ageingBucket, type AgeingKey } from "@/lib/sales/constants";
import type { OpenDocument } from "@/lib/sales/balances";

const KIND_LABELS: Record<OpenDocument["kind"], string> = {
  INVOICE: "Invoice",
  ROUGH: "Rough purchase",
  JOB_WORK: "Job-work bill",
  BROKERAGE: "Brokerage",
};

function docHref(d: OpenDocument): string | null {
  if (d.kind === "INVOICE" || d.kind === "BROKERAGE") return `/sales/invoices/${d.id}`;
  if (d.kind === "ROUGH") return `/rough/${d.id}`;
  return null;
}

// Party-by-party ageing summary (per currency) and the open documents under
// it, oldest first. Ageing counts days since the document date.
export function AgeingReport({ docs, payHref }: { docs: OpenDocument[]; payHref: (d: OpenDocument) => string }) {
  type Summary = { partyId: string; partyName: string; currency: string; total: number } & Record<AgeingKey, number>;
  const now = new Date();
  const summaries = new Map<string, Summary>();
  const totals = new Map<string, Record<AgeingKey | "total", number>>();
  for (const d of docs) {
    const bucket = ageingBucket(daysSince(d.date, now));
    const key = `${d.partyId}:${d.currency}`;
    const s = summaries.get(key) ?? { partyId: d.partyId, partyName: d.partyName, currency: d.currency, total: 0, d0: 0, d31: 0, d61: 0, d90: 0 };
    s[bucket] += d.outstandingCents;
    s.total += d.outstandingCents;
    summaries.set(key, s);
    const t = totals.get(d.currency) ?? { total: 0, d0: 0, d31: 0, d61: 0, d90: 0 };
    t[bucket] += d.outstandingCents;
    t.total += d.outstandingCents;
    totals.set(d.currency, t);
  }
  const rows = [...summaries.values()].sort((a, b) => a.currency.localeCompare(b.currency) || b.total - a.total);
  const m = (cents: number, cur: string) => (cents ? formatMoney(cents / 100, cur) : "—");

  if (docs.length === 0) {
    return <p className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">Nothing outstanding.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[...totals.entries()].map(([cur, t]) => (
          <div key={cur} className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">Outstanding in {cur}</p>
            <p className="text-2xl font-semibold text-zinc-900">{formatMoney(t.total / 100, cur)}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {AGEING_BUCKETS.map((b) => `${b.label}: ${m(t[b.key], cur)}`).join(" · ")}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Party</th>
              {AGEING_BUCKETS.map((b) => (
                <th key={b.key} className="px-4 py-3 text-right font-medium">
                  {b.label} days
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={`${s.partyId}:${s.currency}`} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 text-zinc-800">
                  {s.partyName} <span className="text-xs text-zinc-400">{s.currency}</span>
                </td>
                {AGEING_BUCKETS.map((b) => (
                  <td key={b.key} className={`px-4 py-3 text-right ${b.key === "d90" && s[b.key] ? "font-medium text-red-700" : "text-zinc-700"}`}>
                    {m(s[b.key], s.currency)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-medium text-zinc-900">{m(s.total, s.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Days</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Outstanding</th>
              <th className="px-4 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const days = daysSince(d.date, now);
              const overdue = d.dueDate && d.dueDate < now;
              const href = docHref(d);
              return (
                <tr key={`${d.kind}:${d.id}`} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className="block text-xs text-zinc-400">{KIND_LABELS[d.kind]}</span>
                    {href ? (
                      <Link href={href} className="font-mono text-xs font-medium text-zinc-900 hover:underline">
                        {d.ref}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs">{d.ref}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{d.partyName}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(d.date)}
                    {d.dueDate && <span className={`block text-xs ${overdue ? "text-red-700" : ""}`}>due {formatDate(d.dueDate)}</span>}
                  </td>
                  <td className={`px-4 py-3 text-right ${days > 90 ? "font-medium text-red-700" : "text-zinc-600"}`}>{days}</td>
                  <td className="px-4 py-3 text-right text-zinc-600">{formatMoney(d.totalCents / 100, d.currency)}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900">{formatMoney(d.outstandingCents / 100, d.currency)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={payHref(d)} className="text-sm text-zinc-600 underline">
                      Record
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
