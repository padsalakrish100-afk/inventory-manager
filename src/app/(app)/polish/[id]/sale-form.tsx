"use client";

import { useFormAction } from "@/lib/use-form-action";
import { useState } from "react";
import { updateSaleInfo } from "../actions";
import { POLISH_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } from "@/lib/polish-status";

type Defaults = {
  status: string;
  location: string | null;
  askingPrice: number | null;
  currency: string;
  buyerName: string | null;
  soldPrice: number | null;
  soldDate: string | null;
  paymentStatus: string | null;
};

// Status, listing and sale details. Costs live in the stone's cost ledger
// (shown separately to people who can see costs), not on this form.
export function SaleForm({ id, defaults, buyerNames }: { id: string; defaults: Defaults; buyerNames: string[] }) {
  const boundAction = updateSaleInfo.bind(null, id);
  const [error, onSubmit, pending] = useFormAction(boundAction, undefined);
  const [status, setStatus] = useState(defaults.status);

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6">
      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Status &amp; listing
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-zinc-700">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            >
              {POLISH_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-zinc-700">
              Location
            </label>
            <input
              id="location"
              name="location"
              type="text"
              defaultValue={defaults.location ?? ""}
              placeholder="e.g. Surat, NYC - Trevor"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="askingPrice" className="block text-sm font-medium text-zinc-700">
              Asking price
            </label>
            <input
              id="askingPrice"
              name="askingPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={defaults.askingPrice ?? undefined}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-zinc-700">
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              defaultValue={defaults.currency === "INR" ? "INR" : "USD"}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </select>
          </div>
        </div>
      </fieldset>

      {status === "SOLD" && (
        <fieldset className="flex flex-col gap-4 border-0 p-0">
          <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Sale details
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="buyer" className="block text-sm font-medium text-zinc-700">
                Buyer
              </label>
              <input
                id="buyer"
                name="buyer"
                type="text"
                list="buyer-suggestions"
                defaultValue={defaults.buyerName ?? ""}
                placeholder="Type a name — new ones are saved automatically"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
              <datalist id="buyer-suggestions">
                {buyerNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="soldPrice" className="block text-sm font-medium text-zinc-700">
                Sold price
              </label>
              <input
                id="soldPrice"
                name="soldPrice"
                type="number"
                min={0}
                step="0.01"
                defaultValue={defaults.soldPrice ?? undefined}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="soldDate" className="block text-sm font-medium text-zinc-700">
                Sold date
              </label>
              <input
                id="soldDate"
                name="soldDate"
                type="date"
                defaultValue={defaults.soldDate ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="paymentStatus" className="block text-sm font-medium text-zinc-700">
                Payment status
              </label>
              <select
                id="paymentStatus"
                name="paymentStatus"
                defaultValue={defaults.paymentStatus ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              >
                <option value="">—</option>
                {PAYMENT_STATUS_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

