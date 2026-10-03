"use client";

import { useFormAction } from "@/lib/use-form-action";
import { createParty } from "./actions";
import { EMPTY_PARTY_DEFAULTS, PartyFields } from "./party-fields";

export function PartyForm() {
  const [error, onSubmit, pending] = useFormAction(createParty, undefined, { resetOnSuccess: true });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm"
        />
      </div>

      <PartyFields defaults={EMPTY_PARTY_DEFAULTS} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add party"}
      </button>
    </form>
  );
}
