"use client";

import { useFormAction } from "@/lib/use-form-action";
import { createDepartment, updateDepartment } from "../actions";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function DepartmentForm({
  departmentId,
  defaults,
  stageNames,
}: {
  departmentId?: string;
  defaults: { name: string; sortOrder: number; active: boolean };
  stageNames?: string[];
}) {
  const action = departmentId ? updateDepartment.bind(null, departmentId) : createDepartment;
  const [message, onSubmit, pending] = useFormAction(action, undefined);

  return (
    <form
      onSubmit={onSubmit}
      className={`flex flex-col gap-3 rounded-lg border bg-white p-4 ${defaults.active ? "border-zinc-200" : "border-dashed border-zinc-300 opacity-70"}`}
    >
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
      {stageNames && (
        <p className="text-xs text-zinc-500">Stages: {stageNames.length > 0 ? stageNames.join(", ") : "none"}</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-10 items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="active" defaultChecked={defaults.active} className="h-4 w-4" />
          Active
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving..." : departmentId ? "Save" : "Add department"}
        </button>
        {message && (
          <span className={`text-sm ${message === "Saved." ? "text-emerald-700" : "text-red-600"}`}>{message}</span>
        )}
      </div>
    </form>
  );
}
