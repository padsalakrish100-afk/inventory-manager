"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { createOverheadPool, reallocateOverhead, voidOverheadPool } from "../actions";
import { todayIST } from "@/lib/dates";

const inputClass = "mt-1 block min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm";

export function OverheadForm() {
  const [error, onSubmit, pending] = useFormAction(createOverheadPool, undefined, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-6 sm:items-end">
      <label className="text-xs font-medium text-zinc-500">
        Month
        <input name="month" type="month" defaultValue={todayIST().slice(0, 7)} className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Amount
        <input name="amount" inputMode="decimal" required className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Currency
        <select name="currency" defaultValue="INR" className={inputClass}>
          <option value="INR">INR</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <label className="text-xs font-medium text-zinc-500">
        ₹ per $1
        <input name="fxRate" inputMode="decimal" placeholder="rate in force" className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Note
        <input name="note" placeholder="rent, power, staff…" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 min-h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60 sm:col-span-1"
      >
        {pending ? "Spreading..." : "Add & spread"}
      </button>
      {error && <p className="col-span-2 text-sm text-red-600 sm:col-span-6">{error}</p>}
    </form>
  );
}

export function PoolButtons({ poolId, canVoid }: { poolId: string; canVoid: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await reallocateOverhead(poolId);
            setMessage(r.error ?? r.info ?? null);
          })
        }
        className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        Re-spread
      </button>
      {canVoid && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Cancel this overhead? It's removed from every stone.")) return;
            startTransition(async () => {
              await voidOverheadPool(poolId);
            });
          }}
          className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600"
        >
          Cancel
        </button>
      )}
      {message && <span className="text-xs text-zinc-500">{message}</span>}
    </span>
  );
}
