"use client";

import { useState } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { PAYMENT_METHODS } from "@/lib/sales/constants";
import { createPayment } from "../actions";

type Doc = {
  key: string;
  kind: string;
  id: string;
  ref: string;
  date: string;
  currency: string;
  outstanding: string;
  outstandingLabel: string;
};

const INPUT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none sm:text-sm";
const LABEL = "block text-sm font-medium text-zinc-700";
const cents = (v: string) => Math.round((Number(v) || 0) * 100);

// Amount, method and how it's split across the party's open documents
// (oldest first by default). Only documents in the payment's currency can
// be settled; the rest stays on account.
export function PaymentForm({
  direction,
  partyId,
  partyName,
  today,
  defaultCurrency,
  docs,
}: {
  direction: "IN" | "OUT";
  partyId: string;
  partyName: string;
  today: string;
  defaultCurrency: string;
  docs: Doc[];
}) {
  const [error, onSubmit, pending] = useFormAction(createPayment, undefined);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState("");
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const usable = docs.filter((d) => d.currency === currency);

  const fillOldestFirst = (total: string) => {
    let left = cents(total);
    const next: Record<string, string> = {};
    for (const d of usable) {
      const take = Math.min(left, cents(d.outstanding));
      if (take > 0) next[d.key] = (take / 100).toFixed(2);
      left -= take;
    }
    setAlloc(next);
  };

  const allocated = usable.reduce((a, d) => a + cents(alloc[d.key] ?? ""), 0);
  const left = cents(amount) - allocated;
  const payload = JSON.stringify(
    usable.filter((d) => cents(alloc[d.key] ?? "") > 0).map((d) => ({ kind: d.kind, id: d.id, amount: alloc[d.key] })),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="allocations" value={payload} />

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <p className="text-sm text-zinc-500">{direction === "IN" ? "From" : "To"}</p>
          <p className="font-medium text-zinc-900">{partyName}</p>
        </div>
        <div>
          <label htmlFor="amount" className={LABEL}>
            Amount
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              fillOldestFirst(e.target.value);
            }}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="currency" className={LABEL}>
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              setAlloc({});
            }}
            className={INPUT}
          >
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </select>
        </div>
        <div>
          <label htmlFor="date" className={LABEL}>
            Date
          </label>
          <input id="date" name="date" type="date" defaultValue={today} className={INPUT} />
        </div>
        <div>
          <label htmlFor="fxRate" className={LABEL}>
            Exchange rate (₹ per $)
          </label>
          <input id="fxRate" name="fxRate" inputMode="decimal" placeholder="Blank = rate on file" className={INPUT} />
        </div>
        <div>
          <label htmlFor="method" className={LABEL}>
            Method
          </label>
          <select id="method" name="method" defaultValue="" className={INPUT}>
            <option value="">—</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="reference" className={LABEL}>
            Reference
          </label>
          <input id="reference" name="reference" placeholder="UTR, cheque no., SWIFT ref" className={INPUT} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Settles
        </legend>
        {docs.length === 0 && <p className="text-sm text-zinc-500">Nothing open for this party — the whole amount is held on account.</p>}
        {docs.length > 0 && usable.length === 0 && (
          <p className="text-sm text-amber-700">Nothing open in {currency}. Change the currency to settle the documents below.</p>
        )}
        <ul className="flex flex-col gap-2">
          {docs.map((d) => {
            const enabled = d.currency === currency;
            return (
              <li key={d.key} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 ${enabled ? "" : "opacity-50"}`}>
                <div className="text-sm">
                  <p className="font-medium text-zinc-900">{d.ref}</p>
                  <p className="text-zinc-500">
                    {d.date} · {d.outstandingLabel} outstanding
                  </p>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={d.outstanding}
                  step="0.01"
                  disabled={!enabled}
                  value={alloc[d.key] ?? ""}
                  onChange={(e) => setAlloc((a) => ({ ...a, [d.key]: e.target.value }))}
                  aria-label={`Amount for ${d.ref}`}
                  className="min-h-11 w-36 rounded-md border border-zinc-300 px-3 text-right text-base sm:text-sm"
                />
              </li>
            );
          })}
        </ul>
        {cents(amount) > 0 && (
          <p className={`text-sm ${left < 0 ? "text-red-600" : "text-zinc-600"}`}>
            {left < 0
              ? `Allocated ${((allocated - cents(amount)) / 100).toFixed(2)} more than the amount.`
              : left > 0
                ? `${(left / 100).toFixed(2)} ${currency} will be held on account.`
                : "Fully allocated."}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="notes" className={LABEL}>
          Notes
        </label>
        <input id="notes" name="notes" placeholder="Optional" className={INPUT} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || left < 0}
        className="min-h-12 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : direction === "IN" ? "Save receipt" : "Save payment"}
      </button>
    </form>
  );
}
