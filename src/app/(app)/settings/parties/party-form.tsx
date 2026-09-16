"use client";

import { useActionState } from "react";
import { createParty } from "./actions";
import { PARTY_CATEGORY_OPTIONS } from "@/lib/party-category";

export function PartyForm() {
  const [error, formAction, pending] = useActionState(createParty, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-zinc-700">
          Category
        </label>
        <select
          id="category"
          name="category"
          required
          defaultValue=""
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
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add party"}
      </button>
    </form>
  );
}
