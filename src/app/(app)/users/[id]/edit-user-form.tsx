"use client";

import { useFormAction } from "@/lib/use-form-action";
import { updateUser } from "../actions";
import { AccessFields } from "../access-fields";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function EditUserForm({
  id,
  isSelf,
  departments,
  defaults,
}: {
  id: string;
  isSelf: boolean;
  departments: { id: string; name: string }[];
  defaults: { name: string; email: string; active: boolean; role: string; canSeeCosts: boolean; departmentIds: string[] };
}) {
  const [error, onSubmit, pending] = useFormAction(updateUser.bind(null, id), undefined);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
          Name
        </label>
        <input id="name" name="name" required defaultValue={defaults.name} className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input id="email" name="email" type="email" required defaultValue={defaults.email} className={inputClass} />
      </div>

      <AccessFields departments={departments} defaults={defaults} />

      {!isSelf && (
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={defaults.active} className="h-4 w-4" />
          Active (can sign in)
        </label>
      )}
      {isSelf && <input type="hidden" name="active" value="on" />}

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-zinc-700">
          Reset password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="text"
          autoComplete="off"
          placeholder="Leave blank to keep the current password"
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
