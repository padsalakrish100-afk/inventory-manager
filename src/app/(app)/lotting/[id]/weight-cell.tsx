"use client";

import { useState, useTransition } from "react";
import { updateStoneWeight } from "../actions";

export function WeightCell({ productId, initialWeight }: { productId: string; initialWeight: number | null }) {
  const [value, setValue] = useState(initialWeight !== null ? String(initialWeight) : "");
  const [saved, setSaved] = useState(initialWeight !== null ? String(initialWeight) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value === saved) return;
    setError(null);
    startTransition(async () => {
      const result = await updateStoneWeight(productId, value);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(value);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        placeholder="—"
        className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-500 focus:outline-none"
      />
      <span className="text-xs text-zinc-400">ct</span>
      {isPending && <span className="text-xs text-zinc-400">Saving…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
