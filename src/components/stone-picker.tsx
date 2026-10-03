"use client";

import { useMemo, useState } from "react";

export type PickableStone = {
  stoneId: string;
  stockId: string;
  description: string;
  carats: string;
  askingTotal: string | null;
  askingCurrency: string;
  // Set when the stone is out on a memo (invoice form only).
  memo?: { lineId: string; memoNo: string; partyName: string; amount: string; currency: string } | null;
};

type Line = { stoneId: string; amount: string; perCt: string };

const money = (n: number) => (Number.isFinite(n) && n > 0 ? n.toFixed(2) : "");

// Choose stones for a memo or invoice and price each one, per carat or as a
// total (either updates the other). Posts the lines as JSON in `lines`.
export function StonePicker({
  stones,
  currency,
  initial = [],
}: {
  stones: PickableStone[];
  currency: string;
  initial?: string[];
}) {
  const byId = useMemo(() => new Map(stones.map((s) => [s.stoneId, s])), [stones]);
  const defaultAmount = (s: PickableStone) => {
    if (s.memo && s.memo.currency === currency) return s.memo.amount;
    if (s.askingTotal && s.askingCurrency === currency) return s.askingTotal;
    return "";
  };
  const makeLine = (s: PickableStone): Line => {
    const amount = defaultAmount(s);
    return { stoneId: s.stoneId, amount, perCt: amount ? money(Number(amount) / Number(s.carats)) : "" };
  };
  const [lines, setLines] = useState<Line[]>(() =>
    initial.map((id) => byId.get(id)).filter((s): s is PickableStone => Boolean(s)).map(makeLine),
  );
  const [query, setQuery] = useState("");

  const chosen = new Set(lines.map((l) => l.stoneId));
  const q = query.trim().toLowerCase();
  const available = stones
    .filter((s) => !chosen.has(s.stoneId))
    .filter((s) => !q || s.stockId.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.memo?.memoNo.toLowerCase().includes(q))
    .slice(0, 30);

  const update = (stoneId: string, field: "amount" | "perCt", value: string) =>
    setLines((ls) =>
      ls.map((l) => {
        if (l.stoneId !== stoneId) return l;
        const ct = Number(byId.get(stoneId)!.carats);
        return field === "amount"
          ? { ...l, amount: value, perCt: ct > 0 && value ? money(Number(value) / ct) : "" }
          : { ...l, perCt: value, amount: value ? money(Number(value) * ct) : "" };
      }),
    );

  const totalCarats = lines.reduce((a, l) => a + Number(byId.get(l.stoneId)!.carats), 0);
  const total = lines.reduce((a, l) => a + (Number(l.amount) || 0), 0);
  const payload = JSON.stringify(
    lines.map((l) => ({ stoneId: l.stoneId, amount: l.amount, ...(byId.get(l.stoneId)!.memo ? { memoLineId: byId.get(l.stoneId)!.memo!.lineId } : {}) })),
  );

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="lines" value={payload} />

      {lines.length > 0 && (
        <ul className="flex flex-col gap-2">
          {lines.map((l) => {
            const s = byId.get(l.stoneId)!;
            return (
              <li key={l.stoneId} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-mono font-medium text-zinc-900">{s.stockId}</span>{" "}
                    <span className="text-zinc-500">· {Number(s.carats).toFixed(3)} ct</span>
                    <p className="text-zinc-600">{s.description}</p>
                    {s.memo && <p className="text-xs text-purple-700">On memo {s.memo.memoNo} — {s.memo.partyName}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((x) => x.stoneId !== l.stoneId))}
                    className="min-h-11 shrink-0 rounded-md px-3 text-sm text-zinc-500 hover:bg-zinc-100"
                    aria-label={`Remove ${s.stockId}`}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-medium text-zinc-500">
                    {currency} per ct
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={l.perCt}
                      onChange={(e) => update(l.stoneId, "perCt", e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base sm:text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-zinc-500">
                    Total {currency}
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={l.amount}
                      onChange={(e) => update(l.stoneId, "amount", e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base sm:text-sm"
                    />
                  </label>
                </div>
              </li>
            );
          })}
          <li className="flex justify-between px-1 text-sm font-medium text-zinc-900">
            <span>
              {lines.length} {lines.length === 1 ? "stone" : "stones"} · {totalCarats.toFixed(3)} ct
            </span>
            <span>
              {currency} {total.toLocaleString(currency === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </li>
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a stone — Stock ID, cut, color…"
          className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base sm:text-sm"
        />
        {available.length === 0 ? (
          <p className="text-sm text-zinc-500">{stones.length === 0 ? "No stones available." : "No more matching stones."}</p>
        ) : (
          <ul className="flex max-h-80 flex-col divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
            {available.map((s) => (
              <li key={s.stoneId}>
                <button
                  type="button"
                  onClick={() => setLines((ls) => [...ls, makeLine(s)])}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  <span>
                    <span className="font-mono font-medium text-zinc-900">{s.stockId}</span>{" "}
                    <span className="text-zinc-500">· {Number(s.carats).toFixed(3)} ct · {s.description}</span>
                    {s.memo && <span className="block text-xs text-purple-700">On memo {s.memo.memoNo} — {s.memo.partyName}</span>}
                  </span>
                  <span className="shrink-0 text-zinc-400">+ Add</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
