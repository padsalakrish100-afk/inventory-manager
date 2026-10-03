"use client";

import { useFormAction } from "@/lib/use-form-action";
import { createStage, updateStage } from "../actions";

export type StageDefaults = {
  name: string;
  sortOrder: number;
  departmentId: string | null;
  defaultLossLimitPct: string | null;
  isLabourBillable: boolean;
  active: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

// One stage as an editable card, or (without `stageId`) the "add stage" form.
export function StageForm({
  stageId,
  code,
  legacy,
  defaults,
  departments,
}: {
  stageId?: string;
  code?: string;
  legacy?: boolean;
  defaults: StageDefaults;
  departments: { id: string; name: string }[];
}) {
  const action = stageId ? updateStage.bind(null, stageId) : createStage;
  const [message, onSubmit, pending] = useFormAction(action, undefined);

  return (
    <form
      onSubmit={onSubmit}
      className={`flex flex-col gap-3 rounded-lg border bg-white p-4 ${defaults.active ? "border-zinc-200" : "border-dashed border-zinc-300 opacity-70"}`}
    >
      {code && (
        <p className="font-mono text-xs text-zinc-400">
          {code}
          {legacy && " · used by existing records"}
        </p>
      )}
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Name</label>
          <input name="name" required defaultValue={defaults.name} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Order</label>
          <input name="sortOrder" type="number" inputMode="numeric" defaultValue={defaults.sortOrder} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-500">Department</label>
          <select name="departmentId" defaultValue={defaults.departmentId ?? ""} className={inputClass}>
            <option value="">None (any operator)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Default allowed loss %</label>
          <input
            name="defaultLossLimitPct"
            inputMode="decimal"
            placeholder="e.g. 8"
            defaultValue={defaults.defaultLossLimitPct ?? ""}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-zinc-700">
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" name="isLabourBillable" defaultChecked={defaults.isLabourBillable} className="h-4 w-4" />
          Karigar labour charged
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={defaults.active} className="h-4 w-4" />
          Active
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving..." : stageId ? "Save" : "Add stage"}
        </button>
        {message && (
          <span className={`text-sm ${message === "Saved." ? "text-emerald-700" : "text-red-600"}`}>{message}</span>
        )}
      </div>
    </form>
  );
}
