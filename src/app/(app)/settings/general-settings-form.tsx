"use client";

import { useFormAction } from "@/lib/use-form-action";
import { updateGeneralSettings } from "./actions";

export function GeneralSettingsForm({
  pendingAlertDays,
  costAllocationMethod,
}: {
  pendingAlertDays: number;
  costAllocationMethod: string;
}) {
  const [message, onSubmit, pending] = useFormAction(updateGeneralSettings, undefined);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="pendingAlertDays" className="block text-sm font-medium text-zinc-700">
          Highlight stones out longer than (days)
        </label>
        <input
          id="pendingAlertDays"
          name="pendingAlertDays"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          defaultValue={pendingAlertDays}
          className="mt-1 w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">Used by the Pending report.</p>
      </div>
      <div>
        <label htmlFor="costAllocationMethod" className="block text-sm font-medium text-zinc-700">
          Divide shared costs between stones
        </label>
        <select
          id="costAllocationMethod"
          name="costAllocationMethod"
          defaultValue={costAllocationMethod}
          className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="WEIGHT">By weight (carats)</option>
          <option value="EQUAL">Equally per stone</option>
        </select>
        <p className="mt-1 text-xs text-zinc-500">For rough purchases, job-work bills and overhead. Applies to the next allocation.</p>
      </div>
      {message && <p className={`text-sm ${message === "Saved." ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 w-fit rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
