"use client";

import { useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { addLossLimit, deleteLossLimit } from "../actions";
import { todayIST } from "@/lib/dates";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function LossLimitForm({
  stages,
  karigarNames,
}: {
  stages: { id: string; name: string }[];
  karigarNames: string[];
}) {
  const [error, onSubmit, pending] = useFormAction(addLossLimit, undefined, { resetOnSuccess: true });

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-5 sm:items-end">
      <label className="text-xs font-medium text-zinc-500">
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
        Karigar
        <input name="party" list="limit-karigars" required className={inputClass} />
        <datalist id="limit-karigars">
          {karigarNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Allowed loss %
        <input name="allowedPct" inputMode="decimal" required placeholder="e.g. 6.5" className={inputClass} />
      </label>
      <label className="text-xs font-medium text-zinc-500">
        Effective from
        <input name="effectiveFrom" type="date" defaultValue={todayIST()} className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add limit"}
      </button>
      {error && <p className="text-sm text-red-600 sm:col-span-5">{error}</p>}
    </form>
  );
}

export function DeleteLossLimitButton({ limitId }: { limitId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Remove this karigar-specific limit? The stage default will apply from now on.")) return;
        startTransition(() => deleteLossLimit(limitId));
      }}
      className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
