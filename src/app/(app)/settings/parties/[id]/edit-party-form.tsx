"use client";

import { useActionState } from "react";
import { updateParty } from "../actions";
import { PARTY_CATEGORY_OPTIONS } from "@/lib/party-category";

type Defaults = {
  category: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export function EditPartyForm({ id, defaults }: { id: string; defaults: Defaults }) {
  const boundAction = updateParty.bind(null, id);
  const [error, formAction, pending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-zinc-700">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={defaults.category ?? ""}
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="" disabled>
            Choose one...
          </option>
          {PARTY_CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="text"
          defaultValue={defaults.phone ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={defaults.email ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-zinc-700">
          Address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          defaultValue={defaults.address ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
          Notes
        </label>
        <input
          id="notes"
          name="notes"
          type="text"
          defaultValue={defaults.notes ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
