"use client";

import { useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { addCostEntry, voidCostEntry } from "../../costing/actions";
import { todayIST } from "@/lib/dates";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function CostEntryForm({ stoneId }: { stoneId: string }) {
  const [error, onSubmit, pending] = useFormAction(addCostEntry.bind(null, stoneId), undefined, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-6 sm:items-end">
      <label className="text-xs font-medium text-zinc-500">
        Cost
        <select name="type" defaultValue="CERTIFICATION" className={inputClass}>
          <option value="CERTIFICATION">Certification</option>
          <option value="OTHER">Other expense</option>
          <option value="ROUGH">Rough (no purchase)</option>
        </select>
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
        Date
        <input name="date" type="date" defaultValue={todayIST()} className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Note
        <input name="note" placeholder="e.g. GIA fee" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 min-h-11 rounded-md border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 sm:col-span-1"
      >
        {pending ? "Adding..." : "Add cost"}
      </button>
      <input type="hidden" name="fxRate" value="" />
      {error && <p className="col-span-2 text-sm text-red-600 sm:col-span-6">{error}</p>}
    </form>
  );
}

export function VoidCostButton({ entryId }: { entryId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Remove this cost?")) return;
        startTransition(async () => {
          const r = await voidCostEntry(entryId);
          if (r.error) alert(r.error);
        });
      }}
      className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600"
    >
      Remove
    </button>
  );
}
