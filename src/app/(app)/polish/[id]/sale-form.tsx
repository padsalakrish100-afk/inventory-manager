"use client";

import { useActionState, useState } from "react";
import { updateSaleInfo } from "../actions";
import { POLISH_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, computeTotalCost } from "@/lib/polish-status";
import { formatMoney } from "@/lib/format";

type Defaults = {
  status: string;
  location: string | null;
  askingPrice: number | null;
  currency: string;
  buyerName: string | null;
  soldPrice: number | null;
  soldDate: string | null;
  paymentStatus: string | null;
  roughCostAlloc: number | null;
  laborCost: number | null;
  certCost: number | null;
  otherCost: number | null;
};

export function SaleForm({
  id,
  defaults,
  buyerNames,
}: {
  id: string;
  defaults: Defaults;
  buyerNames: string[];
}) {
  const boundAction = updateSaleInfo.bind(null, id);
  const [error, formAction, pending] = useActionState(boundAction, undefined);
  const [status, setStatus] = useState(defaults.status);
  const [currency, setCurrency] = useState(defaults.currency);

  const [costs, setCosts] = useState({
    roughCostAlloc: defaults.roughCostAlloc,
    laborCost: defaults.laborCost,
    certCost: defaults.certCost,
    otherCost: defaults.otherCost,
  });
  const [soldPrice, setSoldPrice] = useState(defaults.soldPrice);

  const totalCost = computeTotalCost(costs);
  const margin = soldPrice !== null ? soldPrice - totalCost : null;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
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
            <input
              id="currency"
              name="currency"
              type="text"
              list="currency-suggestions"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
            <datalist id="currency-suggestions">
              <option value="USD" />
              <option value="INR" />
              <option value="EUR" />
              <option value="GBP" />
            </datalist>
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
                onChange={(e) => setSoldPrice(e.target.value ? Number(e.target.value) : null)}
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

      <fieldset className="flex flex-col gap-4 border-0 p-0">
        <legend className="mb-1 w-full border-b border-zinc-200 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Cost breakdown
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <CostField
            label="Rough cost (allocated)"
            name="roughCostAlloc"
            value={costs.roughCostAlloc}
            onChange={(v) => setCosts((c) => ({ ...c, roughCostAlloc: v }))}
          />
          <CostField
            label="Labor cost"
            name="laborCost"
            value={costs.laborCost}
            onChange={(v) => setCosts((c) => ({ ...c, laborCost: v }))}
          />
          <CostField
            label="Certification cost"
            name="certCost"
            value={costs.certCost}
            onChange={(v) => setCosts((c) => ({ ...c, certCost: v }))}
          />
          <CostField
            label="Other cost"
            name="otherCost"
            value={costs.otherCost}
            onChange={(v) => setCosts((c) => ({ ...c, otherCost: v }))}
          />
        </div>

        {status === "SOLD" && (
          <div className="flex flex-wrap gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <p className="text-xs text-zinc-500">Total cost</p>
              <p className="text-lg font-semibold text-zinc-900">{formatMoney(totalCost, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Margin</p>
              <p
                className={`text-lg font-semibold ${
                  margin !== null && margin < 0 ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {margin !== null ? formatMoney(margin, currency) : "—"}
              </p>
            </div>
          </div>
        )}
      </fieldset>

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

function CostField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        step="0.01"
        defaultValue={value ?? undefined}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      />
    </div>
  );
}
