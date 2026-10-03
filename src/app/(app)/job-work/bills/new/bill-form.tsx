"use client";

import { useFormAction } from "@/lib/use-form-action";
import { createJobWorkBill } from "../../actions";
import { formatDate, todayIST } from "@/lib/dates";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function BillForm({
  partyId,
  jobs,
}: {
  partyId: string;
  jobs: { id: string; sku: string; stage: string; issueWeight: number | null; returnWeight: number | null; returnDate: string }[];
}) {
  const [error, onSubmit, pending] = useFormAction(createJobWorkBill, undefined);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
      <input type="hidden" name="partyId" value={partyId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Bill number
          <input name="billNo" required className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Bill date
          <input name="date" type="date" defaultValue={todayIST()} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Amount
          <input name="amount" inputMode="decimal" required className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Currency
          <select name="currency" defaultValue="INR" className={inputClass}>
            <option value="INR">INR</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-700">Jobs this bill covers</legend>
        <div className="mt-2 flex flex-col gap-1">
          {jobs.map((j) => (
            <label
              key={j.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-zinc-500 has-[:checked]:bg-zinc-50"
            >
              <input type="checkbox" name="movementIds[]" value={j.id} defaultChecked className="h-4 w-4" />
              <span className="font-mono text-xs">{j.sku}</span>
              <span className="text-zinc-500">
                {j.stage} · {j.issueWeight} → {j.returnWeight} ct · returned {formatDate(j.returnDate)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="text-sm font-medium text-zinc-700">
        Notes
        <input name="notes" className={inputClass} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save bill"}
      </button>
    </form>
  );
}
