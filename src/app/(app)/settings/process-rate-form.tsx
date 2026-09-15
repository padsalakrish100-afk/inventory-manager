"use client";

import { useActionState } from "react";
import { addProcessRate } from "./actions";
import { MANUFACTURING_STAGE_OPTIONS } from "@/lib/stages";

export function ProcessRateForm({ partyNames }: { partyNames: string[] }) {
  const [error, formAction, pending] = useActionState(addProcessRate, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div>
        <label htmlFor="rateStage" className="block text-xs font-medium text-zinc-500">
          Process
        </label>
        <select
          id="rateStage"
          name="stage"
          defaultValue="SAWING"
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        >
          {MANUFACTURING_STAGE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="rateParty" className="block text-xs font-medium text-zinc-500">
          Party
        </label>
        <input
          id="rateParty"
          name="party"
          type="text"
          list="rate-party-suggestions"
          required
          placeholder="e.g. Rajesh Sawing Works"
          className="mt-1 w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <datalist id="rate-party-suggestions">
          {partyNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="rateAmount" className="block text-xs font-medium text-zinc-500">
          Rate per carat (₹)
        </label>
        <input
          id="rateAmount"
          name="ratePerCarat"
          type="number"
          min={0}
          step="0.01"
          required
          placeholder="e.g. 50"
          className="mt-1 w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="rateCaratMin" className="block text-xs font-medium text-zinc-500">
          Carat from
        </label>
        <input
          id="rateCaratMin"
          name="caratMin"
          type="number"
          min={0}
          step="0.01"
          placeholder="Optional"
          className="mt-1 w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="rateCaratMax" className="block text-xs font-medium text-zinc-500">
          Carat to
        </label>
        <input
          id="rateCaratMax"
          name="caratMax"
          type="number"
          min={0}
          step="0.01"
          placeholder="Optional"
          className="mt-1 w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add rate"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
