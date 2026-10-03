"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { splitStone } from "../../actions";
import { todayIST } from "@/lib/dates";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function SplitForm({
  stoneId,
  sku,
  currentWeight,
  roughWeight,
}: {
  stoneId: string;
  sku: string;
  currentWeight: number | null;
  roughWeight: number | null;
}) {
  const [children, setChildren] = useState<string[]>(["", ""]);
  const [date, setDate] = useState(todayIST());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const total = children.reduce((s, w) => s + (Number(w) || 0), 0);
  const over = currentWeight !== null && total > currentWeight + 1e-9;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await splitStone({ stoneId, date, notes, children });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.childIds) router.push(`/stones/labels?ids=${result.childIds.join(",")}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {children.map((w, i) => {
          const share = roughWeight !== null && total > 0 && Number(w) > 0 ? (roughWeight * Number(w)) / total : null;
          return (
            <div key={i} className="flex items-end gap-2">
              <label className="flex-1 text-sm font-medium text-zinc-700">
                <span className="font-mono">
                  {sku}-{String.fromCharCode(65 + i)}
                </span>{" "}
                weight (ct)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min={0}
                  value={w}
                  onChange={(e) => setChildren((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                  className={inputClass}
                />
              </label>
              <span className="w-28 pb-3 text-xs text-zinc-500">
                {share !== null ? `rough share ${share.toFixed(3)} ct` : ""}
              </span>
              {children.length > 2 && (
                <button
                  type="button"
                  onClick={() => setChildren((prev) => prev.filter((_, j) => j !== i))}
                  className="min-h-11 px-2 pb-1 text-sm text-zinc-400 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {children.length < 10 && (
          <button
            type="button"
            onClick={() => setChildren((prev) => [...prev, ""])}
            className="min-h-11 w-fit rounded-md border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            + Another stone
          </button>
        )}
      </div>

      <p className={`text-sm ${over ? "font-medium text-red-700" : "text-zinc-600"}`}>
        Children total {total.toFixed(3)} ct of {currentWeight ?? "—"} ct
        {currentWeight !== null && !over && total > 0 && ` · split loss ${(currentWeight - total).toFixed(3)} ct`}
        {over && " — more than the stone weighs"}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inputClass} />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={isPending || over || children.some((w) => !(Number(w) > 0))}
        className="min-h-12 w-full rounded-md bg-[var(--accent)] px-4 py-3 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Splitting..." : `Split into ${children.length} stones & print labels`}
      </button>
    </div>
  );
}
