"use client";

import { useFormAction } from "@/lib/use-form-action";
import { setExchangeRate } from "../actions";
import { todayIST } from "@/lib/dates";

export function FxForm() {
  const [error, onSubmit, pending] = useFormAction(setExchangeRate, undefined, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <label className="text-xs font-medium text-zinc-500">
        Date
        <input name="date" type="date" defaultValue={todayIST()} className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        ₹ per $1
        <input
          name="usdInr"
          inputMode="decimal"
          required
          placeholder="e.g. 88.25"
          className="mt-1 block w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save rate"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
