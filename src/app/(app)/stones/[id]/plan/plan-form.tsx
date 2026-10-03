"use client";

import { useTransition } from "react";
import { useFormAction } from "@/lib/use-form-action";
import { makePlanFinal, savePlan } from "../../../planning/actions";
import { CUT_STYLES, SHAPES } from "@/lib/cuts";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function PlanForm({
  stoneId,
  defaults,
}: {
  stoneId: string;
  defaults: { plannedShape: string; plannedCutStyle: string; expColor: string; expClarity: string; expCut: string; currency: string };
}) {
  const [error, onSubmit, pending] = useFormAction(savePlan.bind(null, stoneId), undefined, { resetOnSuccess: true });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Shape
          <input name="plannedShape" list="plan-shapes" required defaultValue={defaults.plannedShape} className={inputClass} />
          <datalist id="plan-shapes">
            {SHAPES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Cut style
          <select name="plannedCutStyle" defaultValue={defaults.plannedCutStyle} className={inputClass}>
            <option value="">—</option>
            {CUT_STYLES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Planned polished weight (ct)
          <input name="plannedWeight" inputMode="decimal" required className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Expected color
          <input name="expColor" defaultValue={defaults.expColor} placeholder="e.g. H" className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Expected clarity
          <input name="expClarity" defaultValue={defaults.expClarity} placeholder="e.g. VS1" className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Expected cut
          <input name="expCut" defaultValue={defaults.expCut} placeholder="e.g. Very good" className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Expected value
          <input name="expectedValue" inputMode="decimal" className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Currency
          <select name="currency" defaultValue={defaults.currency} className={inputClass}>
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </select>
        </label>
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Plan files (Sarine, Galaxy, images, PDF — up to 3 MB each)
        <input name="planFiles" type="file" multiple className="mt-1 block w-full text-sm" />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Notes
        <input name="notes" className={inputClass} />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-700">
        <input type="checkbox" name="makeFinal" defaultChecked className="h-4 w-4" />
        Make this the final plan
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save plan"}
      </button>
    </form>
  );
}

export function MakeFinalButton({ planId }: { planId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const r = await makePlanFinal(planId);
          if (r.error) alert(r.error);
        })
      }
      className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
    >
      Make final
    </button>
  );
}
