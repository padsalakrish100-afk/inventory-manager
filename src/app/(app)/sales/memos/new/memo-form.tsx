"use client";

import { useState } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { StonePicker, type PickableStone } from "@/components/stone-picker";
import { createSalesMemo } from "../actions";

const INPUT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none sm:text-sm";
const LABEL = "block text-sm font-medium text-zinc-700";

export function MemoForm({
  stones,
  customers,
  initialStones,
  defaults,
}: {
  stones: PickableStone[];
  customers: string[];
  initialStones: string[];
  defaults: { date: string; dueDate: string; terms: string };
}) {
  const [error, onSubmit, pending] = useFormAction(createSalesMemo, undefined);
  const [currency, setCurrency] = useState("USD");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="party" className={LABEL}>
            Customer
          </label>
          <input id="party" name="party" required list="customer-list" placeholder="Type a name — new ones are saved" className={INPUT} />
          <datalist id="customer-list">
            {customers.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="date" className={LABEL}>
            Memo date
          </label>
          <input id="date" name="date" type="date" defaultValue={defaults.date} className={INPUT} />
        </div>
        <div>
          <label htmlFor="dueDate" className={LABEL}>
            Due back by
          </label>
          <input id="dueDate" name="dueDate" type="date" required defaultValue={defaults.dueDate} className={INPUT} />
        </div>
        <div>
          <label htmlFor="currency" className={LABEL}>
            Currency
          </label>
          <select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={INPUT}>
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </select>
        </div>
        <div>
          <label htmlFor="fxRate" className={LABEL}>
            Exchange rate (₹ per $)
          </label>
          <input id="fxRate" name="fxRate" inputMode="decimal" placeholder="Blank = rate on file" className={INPUT} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Stones
        </legend>
        <StonePicker stones={stones} currency={currency} initial={initialStones} />
      </fieldset>

      <div>
        <label htmlFor="terms" className={LABEL}>
          Terms
        </label>
        <textarea id="terms" name="terms" rows={4} defaultValue={defaults.terms} className={`${INPUT} py-2`} />
      </div>
      <div>
        <label htmlFor="notes" className={LABEL}>
          Notes
        </label>
        <input id="notes" name="notes" placeholder="Optional — internal" className={INPUT} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Issue memo"}
      </button>
    </form>
  );
}
