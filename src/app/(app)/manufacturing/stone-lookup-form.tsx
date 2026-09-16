"use client";

import { useActionState, useEffect, useRef } from "react";
import { lookupStone } from "./actions";

export function StoneLookupForm() {
  const [error, formAction, pending] = useActionState(lookupStone, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [error]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input
        ref={inputRef}
        name="sku"
        type="text"
        autoComplete="off"
        placeholder="Scan or type a stone number"
        className="w-64 max-w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Looking up..." : "Open"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
