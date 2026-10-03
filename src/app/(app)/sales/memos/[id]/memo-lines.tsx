"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { returnMemoLines } from "../actions";
import { MEMO_LINE_LABELS } from "@/lib/sales/constants";

type Line = {
  id: string;
  stoneId: string;
  polishedId: string | null;
  stockId: string;
  description: string;
  carats: string;
  amount: string;
  perCt: string;
  status: string;
  returnedAt: string | null;
  invoice: { id: string; no: string } | null;
};

// The memo's stones. Tick the ones still out to take them back or (with
// sales rights) invoice them.
export function MemoLines({ memoId, lines, canInvoice, today }: { memoId: string; lines: Line[]; canInvoice: boolean; today: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const outLines = lines.filter((l) => l.status === "OUT");
  const chosen = lines.filter((l) => selected.has(l.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
        {lines.map((l) => (
          <li key={l.id}>
            <label className={`flex min-h-14 items-start gap-3 px-3 py-3 ${l.status === "OUT" ? "cursor-pointer" : ""}`}>
              {l.status === "OUT" ? (
                <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="mt-1 h-5 w-5" />
              ) : (
                <span className="mt-1 h-5 w-5" />
              )}
              <span className="flex-1 text-sm">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    {l.polishedId ? (
                      <Link href={`/polish/${l.polishedId}`} className="font-mono font-medium text-zinc-900 hover:underline">
                        {l.stockId}
                      </Link>
                    ) : (
                      <span className="font-mono font-medium">{l.stockId}</span>
                    )}{" "}
                    <span className="text-zinc-500">· {Number(l.carats).toFixed(3)} ct</span>
                  </span>
                  <span className="font-medium text-zinc-900">{l.amount}</span>
                </span>
                <span className="block text-zinc-600">{l.description}</span>
                <span className="block text-xs text-zinc-500">
                  {l.perCt}/ct ·{" "}
                  <span className={l.status === "OUT" ? "text-purple-700" : ""}>{MEMO_LINE_LABELS[l.status] ?? l.status}</span>
                  {l.returnedAt ? ` ${l.returnedAt}` : ""}
                  {l.invoice && (
                    <>
                      {" on "}
                      <Link href={`/sales/invoices/${l.invoice.id}`} className="underline">
                        {l.invoice.no}
                      </Link>
                    </>
                  )}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {outLines.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-700">{chosen.length === 0 ? "Tick stones to act on them." : `${chosen.length} selected`}</p>
            <button
              type="button"
              onClick={() => setSelected(selected.size === outLines.length ? new Set() : new Set(outLines.map((l) => l.id)))}
              className="min-h-10 rounded-md px-3 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              {selected.size === outLines.length ? "Clear" : "Select all out"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-zinc-500">
              Return date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm" />
            </label>
            <label className="text-xs font-medium text-zinc-500">
              Note
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || chosen.length === 0}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await returnMemoLines({ memoId, lineIds: chosen.map((l) => l.id), date, note });
                  if (r.error) setError(r.error);
                  else setSelected(new Set());
                });
              }}
              className="min-h-12 rounded-lg border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Mark returned"}
            </button>
            {canInvoice && (
              <Link
                href={chosen.length ? `/sales/invoices/new?memo=${memoId}&stones=${chosen.map((l) => l.stoneId).join(",")}` : "#"}
                aria-disabled={chosen.length === 0}
                className={`flex min-h-12 items-center rounded-lg bg-[var(--accent)] px-4 text-base font-medium text-white hover:brightness-110 ${chosen.length === 0 ? "pointer-events-none opacity-50" : ""}`}
              >
                Invoice selected
              </Link>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
