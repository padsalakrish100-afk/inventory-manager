"use client";

import { useState } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { StonePicker, type PickableStone } from "@/components/stone-picker";
import { INCOTERMS } from "@/lib/sales/constants";
import { createInvoice } from "../actions";
import { ShippingFields } from "../shipping-fields";

const INPUT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none sm:text-sm";
const LABEL = "block text-sm font-medium text-zinc-700";
const LEGEND = "mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500";

export function InvoiceForm({
  stones,
  customers,
  brokers,
  initialStones,
  defaults,
}: {
  stones: PickableStone[];
  customers: string[];
  brokers: string[];
  initialStones: string[];
  defaults: {
    party: string;
    currency: string;
    date: string;
    dueDate: string;
    shipToName: string;
    shipToAddress: string;
    shipToCountry: string;
  };
}) {
  const [error, onSubmit, pending] = useFormAction(createInvoice, undefined);
  const [currency, setCurrency] = useState(defaults.currency);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="party" className={LABEL}>
            Customer
          </label>
          <input id="party" name="party" required list="customer-list" defaultValue={defaults.party} placeholder="Type a name — new ones are saved" className={INPUT} />
          <datalist id="customer-list">
            {customers.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="date" className={LABEL}>
            Invoice date
          </label>
          <input id="date" name="date" type="date" defaultValue={defaults.date} className={INPUT} />
        </div>
        <div>
          <label htmlFor="dueDate" className={LABEL}>
            Payment due
          </label>
          <input id="dueDate" name="dueDate" type="date" defaultValue={defaults.dueDate} className={INPUT} />
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
        <legend className={LEGEND}>Stones</legend>
        <StonePicker stones={stones} currency={currency} initial={initialStones} />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4 border-0 p-0">
        <legend className={LEGEND}>Charges &amp; broker</legend>
        <div>
          <label htmlFor="shipping" className={LABEL}>
            Shipping
          </label>
          <input id="shipping" name="shipping" type="number" min={0} step="0.01" inputMode="decimal" className={INPUT} />
        </div>
        <div>
          <label htmlFor="insurance" className={LABEL}>
            Insurance
          </label>
          <input id="insurance" name="insurance" type="number" min={0} step="0.01" inputMode="decimal" className={INPUT} />
        </div>
        <div>
          <label htmlFor="broker" className={LABEL}>
            Broker
          </label>
          <input id="broker" name="broker" list="broker-list" placeholder="Optional" className={INPUT} />
          <datalist id="broker-list">
            {brokers.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="brokeragePct" className={LABEL}>
            Brokerage %
          </label>
          <input id="brokeragePct" name="brokeragePct" inputMode="decimal" placeholder="e.g. 1" className={INPUT} />
        </div>
        <p className="col-span-2 text-xs text-zinc-500">
          Shipping and insurance are added to the invoice total. Brokerage is not printed on the invoice; it is owed to the broker and shows under Payables.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className={LEGEND}>Shipping &amp; export</legend>
        <ShippingFields
          incoterms={[...INCOTERMS]}
          defaults={{ shipToName: defaults.shipToName, shipToAddress: defaults.shipToAddress, shipToCountry: defaults.shipToCountry, hsCode: "7102.39" }}
        />
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Create invoice"}
      </button>
    </form>
  );
}
