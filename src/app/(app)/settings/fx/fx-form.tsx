"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { fillMissingExchangeRates, setExchangeRate } from "../actions";
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

export function FillMissingButton() {
  const [isPending, startTransition] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-600">
        Older entries without a rate are left out of the other currency&apos;s totals. Fill them with the rate in force on
        their own date (only where you&apos;ve entered one that early).
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await fillMissingExchangeRates();
            setInfo(r.info);
          })
        }
        className="min-h-10 w-fit rounded-md border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {isPending ? "Filling..." : "Fill missing rates on older entries"}
      </button>
      {info && <p className="text-sm text-emerald-700">{info}</p>}
    </div>
  );
}
