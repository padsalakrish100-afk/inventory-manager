"use client";

import { useFormAction } from "@/lib/use-form-action";
import { useState } from "react";
import { createLot } from "./actions";

// `showCost`: rough price is hidden from people who can't see costs.
export function LotForm({ partyNames, showCost }: { partyNames: string[]; showCost: boolean }) {
  const [error, onSubmit, pending] = useFormAction(createLot, undefined);

  const [roughWeight, setRoughWeight] = useState("");
  const [ratePerCarat, setRatePerCarat] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [costOverridden, setCostOverridden] = useState(false);

  function recomputeCost(weight: string, rate: string) {
    if (costOverridden) return;
    const w = Number(weight);
    const r = Number(rate);
    if (weight && rate && Number.isFinite(w) && Number.isFinite(r)) {
      setPurchaseCost((w * r).toFixed(2));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-5">
      <div>
        <label htmlFor="sourceParty" className="block text-sm font-medium text-zinc-700">
          Source (tender or party)
        </label>
        <input
          id="sourceParty"
          name="sourceParty"
          type="text"
          list="source-party-suggestions"
          required
          placeholder="e.g. Surat Tender Feb-2026, or a party name"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <datalist id="source-party-suggestions">
          {partyNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="roughWeight" className="block text-sm font-medium text-zinc-700">
          Rough weight (carat)
        </label>
        <input
          id="roughWeight"
          name="roughWeight"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.001"
          value={roughWeight}
          onChange={(e) => {
            setRoughWeight(e.target.value);
            recomputeCost(e.target.value, ratePerCarat);
          }}
          placeholder="e.g. 500"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {showCost && (
      <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="ratePerCarat" className="block text-sm font-medium text-zinc-700">
            Rough price / carat
          </label>
          <input
            id="ratePerCarat"
            type="number"
            min={0}
            step="0.01"
            value={ratePerCarat}
            onChange={(e) => {
              setRatePerCarat(e.target.value);
              recomputeCost(roughWeight, e.target.value);
            }}
            placeholder="e.g. 50"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="purchaseCost" className="block text-sm font-medium text-zinc-700">
            Total purchase cost
          </label>
          <input
            id="purchaseCost"
            name="purchaseCost"
            type="number"
            min={0}
            step="0.01"
            value={purchaseCost}
            onChange={(e) => {
              setPurchaseCost(e.target.value);
              setCostOverridden(true);
            }}
            placeholder="e.g. 25000"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-zinc-500">
        Enter either one — price/carat × weight fills the total automatically. Only the total is saved; used later
        to auto-split a rough cost share across each stone by weight.
      </p>
      </>
      )}

      <div>
        <label htmlFor="stoneCount" className="block text-sm font-medium text-zinc-700">
          Number of stones
        </label>
        <input
          id="stoneCount"
          name="stoneCount"
          type="number"
          min={1}
          max={5000}
          required
          placeholder="e.g. 500"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          The lot number and every stone&apos;s number are generated automatically — nothing else to fill in.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create lot"}
      </button>
    </form>
  );
}
