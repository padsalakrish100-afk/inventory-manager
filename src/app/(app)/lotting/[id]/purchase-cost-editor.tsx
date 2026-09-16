"use client";

import { useState, useTransition } from "react";
import { updateLotPurchaseCost } from "../actions";

export function PurchaseCostEditor({
  lotId,
  initialCost,
  roughWeight,
}: {
  lotId: string;
  initialCost: number | null;
  roughWeight: number | null;
}) {
  const [value, setValue] = useState(initialCost !== null ? String(initialCost) : "");
  const [saved, setSaved] = useState(initialCost !== null ? String(initialCost) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value === saved) return;
    setError(null);
    startTransition(async () => {
      const result = await updateLotPurchaseCost(lotId, value);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(value);
      }
    });
  }

  const perCarat = value && roughWeight ? Number(value) / roughWeight : null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="—"
        className="w-24 rounded-md border border-zinc-300 px-2 py-0.5 text-sm focus:border-zinc-500 focus:outline-none"
      />
      {perCarat !== null && Number.isFinite(perCarat) && (
        <span className="text-xs text-zinc-400">(≈ {perCarat.toFixed(2)}/ct)</span>
      )}
      {isPending && <span className="text-xs text-zinc-400">Saving…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
