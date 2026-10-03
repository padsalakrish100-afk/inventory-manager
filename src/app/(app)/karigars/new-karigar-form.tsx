"use client";

import { useFormAction } from "@/lib/use-form-action";
import { createKarigar } from "./actions";
import { KarigarFields, karigarInputClass } from "./karigar-fields";

export function NewKarigarForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [error, onSubmit, pending] = useFormAction(createKarigar, undefined);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="text-sm font-medium text-zinc-700">
        Name
        <input name="name" required className={karigarInputClass} />
      </label>
      <KarigarFields
        departments={departments}
        defaults={{ phone: "", employeeCode: "", joiningDate: "", notes: "", departmentIds: [] }}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add karigar"}
      </button>
    </form>
  );
}
