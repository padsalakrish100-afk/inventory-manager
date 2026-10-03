"use client";

import { useState, useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { addRateCard, deleteRateCard, adjustLabourEntry } from "./actions";
import { todayIST } from "@/lib/dates";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

// Adds a rate for a karigar (partyId) or a stage default (no partyId).
export function RateCardForm({ partyId, stages }: { partyId?: string; stages: { id: string; name: string }[] }) {
  const [error, onSubmit, pending] = useFormAction(addRateCard, undefined, { resetOnSuccess: true });

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-5 sm:items-end">
      <input type="hidden" name="partyId" value={partyId ?? ""} />
      <label className="col-span-2 text-xs font-medium text-zinc-500 sm:col-span-1">
        Stage
        <select name="stageId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose…
          </option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Charged
        <select name="basis" defaultValue="PER_CARAT" className={inputClass}>
          <option value="PER_CARAT">Per carat</option>
          <option value="PER_PIECE">Per piece</option>
          <option value="FIXED">Fixed per job</option>
        </select>
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Rate (₹)
        <input name="rate" inputMode="decimal" required className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        From
        <input name="effectiveFrom" type="date" defaultValue={todayIST()} className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60 sm:col-span-1"
      >
        {pending ? "Adding..." : "Add rate"}
      </button>
      {error && <p className="col-span-2 text-sm text-red-600 sm:col-span-5">{error}</p>}
    </form>
  );
}

export function DeleteRateButton({ rateId }: { rateId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Delete this rate? Only allowed if no labour was priced from it.")) return;
          startTransition(async () => {
            const r = await deleteRateCard(rateId);
            if (r.error) setError(r.error);
          });
        }}
        className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600"
      >
        Delete
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function AdjustLabourButton({ entryId, amount }: { entryId: string; amount: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const next = prompt("New amount (₹)", amount);
          if (next === null) return;
          const note = prompt("Why is it being changed?");
          if (note === null) return;
          startTransition(async () => {
            const r = await adjustLabourEntry(entryId, next.trim(), note);
            if (r.error) setError(r.error);
          });
        }}
        className="min-h-10 px-2 text-sm text-zinc-500 hover:underline"
      >
        Adjust
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
