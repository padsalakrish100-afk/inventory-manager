"use client";

import { useActionState, useEffect, useRef } from "react";
import { lookupBySku } from "../products/actions";

export function ScanForm() {
  const [error, formAction, pending] = useActionState(lookupBySku, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (error) {
      inputRef.current?.select();
    }
  }, [error]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="sku" className="text-sm font-medium text-zinc-700">
        Scan or type a SKU
      </label>
      <input
        ref={inputRef}
        id="sku"
        name="sku"
        type="text"
        autoComplete="off"
        autoFocus
        placeholder="Click here, then scan the barcode"
        className="w-full rounded-md border border-zinc-300 px-4 py-3 text-lg focus:border-zinc-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Looking up..." : "Open"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
