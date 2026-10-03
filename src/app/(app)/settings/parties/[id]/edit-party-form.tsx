"use client";

import { useFormAction } from "@/lib/use-form-action";
import { updateParty } from "../actions";
import { PartyFields, type PartyFieldDefaults } from "../party-fields";

export function EditPartyForm({ id, defaults }: { id: string; defaults: PartyFieldDefaults }) {
  const boundAction = updateParty.bind(null, id);
  const [error, onSubmit, pending] = useFormAction(boundAction, undefined);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PartyFields defaults={defaults} />

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
