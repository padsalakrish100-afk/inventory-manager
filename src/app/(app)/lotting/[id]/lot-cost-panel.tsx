"use client";

import { useState, useTransition } from "react";
import { allocateLotCost } from "../actions";

// Allocating the lot's rough cost to its stones. For a purchase-packet lot
// the amount and currency come from the purchase; for an older lot the
// currency (never recorded before) is chosen here.
export function LotCostPanel({
  lotId,
  source,
  amountLabel,
  currency,
  fxRate,
  allocatedLabel,
  stonesWithoutWeight,
}: {
  lotId: string;
  source: "packet" | "legacy" | "none";
  amountLabel: string | null;
  currency: string | null;
  fxRate: string | null;
  allocatedLabel: string | null;
  stonesWithoutWeight: number;
}) {
  const [chosenCurrency, setChosenCurrency] = useState(currency ?? "");
  const [fx, setFx] = useState(fxRate ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="font-medium text-zinc-900">Rough cost</h2>
      {source === "none" ? (
        <p className="text-sm text-zinc-500">No purchase cost recorded for this lot.</p>
      ) : (
        <>
          <p className="text-sm text-zinc-600">
            {source === "packet" ? "Share of the rough purchase: " : "Lot purchase cost: "}
            <span className="font-medium text-zinc-900">{amountLabel ?? "not allocated on the purchase yet"}</span>
            {currency && source === "packet" ? ` (${currency})` : ""}
          </p>
          <p className="text-sm text-zinc-600">
            On the stones now: <span className="font-medium text-zinc-900">{allocatedLabel ?? "not allocated"}</span>
          </p>
          {stonesWithoutWeight > 0 && (
            <p className="text-sm text-amber-700">
              {stonesWithoutWeight} stone{stonesWithoutWeight === 1 ? " has" : "s have"} no weight yet — enter weights below
              before allocating by weight.
            </p>
          )}
          {source === "legacy" && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-zinc-500">
                Cost is in
                <select
                  value={chosenCurrency}
                  onChange={(e) => setChosenCurrency(e.target.value)}
                  className="mt-1 block min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="text-xs font-medium text-zinc-500">
                ₹ per $1
                <input
                  value={fx}
                  onChange={(e) => setFx(e.target.value)}
                  inputMode="decimal"
                  placeholder="rate on the lot date"
                  className="mt-1 block min-h-10 w-40 rounded-md border border-zinc-300 px-3 text-sm"
                />
              </label>
            </div>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await allocateLotCost(lotId, { currency: chosenCurrency || null, fxRate: fx });
                setMessage(r.error ? { ok: false, text: r.error } : { ok: true, text: r.info ?? "Done." });
              })
            }
            className="min-h-11 w-fit rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {isPending ? "Allocating..." : allocatedLabel ? "Re-allocate to stones" : "Allocate to stones"}
          </button>
          {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
        </>
      )}
    </section>
  );
}
