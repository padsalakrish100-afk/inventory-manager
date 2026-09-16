"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { returnStones } from "../actions";
import { PROCESS_LABELS, SAWING_PROCESS_VALUES } from "@/lib/process";

type StoneInfo = {
  sku: string;
  weight: string;
  process?: string;
  party?: string;
  startingWeight: number | null;
  topsEntries: string[];
};

function sumTops(entries: string[]): number {
  return entries.reduce((sum, e) => sum + (Number(e) || 0), 0);
}

function recomputeWeightFromTops(row: StoneInfo): StoneInfo {
  const isSawing = row.process && (SAWING_PROCESS_VALUES as readonly string[]).includes(row.process);
  if (!isSawing || row.topsEntries.length === 0 || row.startingWeight === null) return row;
  const remaining = row.startingWeight - sumTops(row.topsEntries);
  return { ...row, weight: (remaining >= 0 ? remaining : 0).toFixed(2) };
}

export function ReturnForm() {
  const [rows, setRows] = useState<StoneInfo[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function addScan() {
    const sku = scanValue.trim();
    if (!sku) return;
    setScanValue("");
    setError(null);
    if (rows.some((r) => r.sku === sku)) return;

    const res = await fetch(`/api/stones/${encodeURIComponent(sku)}`);
    if (!res.ok) {
      setError(`Stone "${sku}" not found or not currently issued anywhere.`);
      return;
    }
    const info = await res.json();
    const startingWeight = info.caratWeight !== null && info.caratWeight !== undefined ? Number(info.caratWeight) : null;
    const weight = startingWeight !== null ? String(startingWeight) : "";
    setRows((prev) => [
      ...prev,
      { sku, weight, process: info.process, party: info.party, startingWeight, topsEntries: [] },
    ]);
  }

  function removeRow(sku: string) {
    setRows((prev) => prev.filter((r) => r.sku !== sku));
  }

  function updateWeight(sku: string, weight: string) {
    setRows((prev) => prev.map((r) => (r.sku === sku ? { ...r, weight } : r)));
  }

  function addTopsEntry(sku: string) {
    setRows((prev) =>
      prev.map((r) => (r.sku === sku ? recomputeWeightFromTops({ ...r, topsEntries: [...r.topsEntries, ""] }) : r)),
    );
  }

  function updateTopsEntry(sku: string, index: number, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.sku === sku
          ? recomputeWeightFromTops({
              ...r,
              topsEntries: r.topsEntries.map((v, i) => (i === index ? value : v)),
            })
          : r,
      ),
    );
  }

  function removeTopsEntry(sku: string, index: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.sku === sku
          ? recomputeWeightFromTops({ ...r, topsEntries: r.topsEntries.filter((_, i) => i !== index) })
          : r,
      ),
    );
  }

  function submit(formData: FormData) {
    setError(null);
    setMessage(null);
    const date = String(formData.get("date") ?? today);
    const notes = String(formData.get("notes") ?? "");
    startTransition(async () => {
      const result = await returnStones({
        date,
        notes,
        stones: rows.map((r) => ({
          sku: r.sku,
          weight: r.weight,
          topsWeight: r.topsEntries.length > 0 ? String(sumTops(r.topsEntries)) : undefined,
        })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(`Returned ${result.returned} stone${result.returned === 1 ? "" : "s"}.`);
      setRows([]);
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-zinc-700">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={today}
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
            placeholder="Optional"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="scan" className="block text-sm font-medium text-zinc-700">
          Scan or type stone numbers
        </label>
        <input
          ref={scanRef}
          id="scan"
          type="text"
          autoComplete="off"
          autoFocus
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addScan();
            }
          }}
          placeholder="Click here, then scan each returning stone's barcode"
          className="mt-1 w-full rounded-md border border-zinc-300 px-4 py-3 text-lg focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Stone number</th>
              <th className="px-4 py-2 font-medium">Currently at</th>
              <th className="px-4 py-2 font-medium">Return weight (ct)</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  No stones scanned yet.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const isSawing = r.process ? (SAWING_PROCESS_VALUES as readonly string[]).includes(r.process) : false;
              return (
                <Fragment key={r.sku}>
                  <tr className={isSawing ? "border-b-0" : "border-b border-zinc-100 last:border-0"}>
                    <td className="px-4 py-2 text-zinc-500">{i + 1}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-800">{r.sku}</td>
                    <td className="px-4 py-2 text-zinc-500">
                      {r.process ? PROCESS_LABELS[r.process] ?? r.process : "—"}
                      {r.party ? ` · ${r.party}` : ""}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.weight}
                        onChange={(e) => updateWeight(r.sku, e.target.value)}
                        className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(r.sku)}
                        className="text-zinc-400 hover:text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                  {isSawing && (
                    <tr className="border-b border-zinc-100 last:border-0 bg-blue-50">
                      <td></td>
                      <td colSpan={4} className="px-4 pb-3">
                        <p className="text-xs font-medium text-blue-700">
                          Tops removed (cut pieces) — starting weight {r.startingWeight ?? "—"} ct
                        </p>
                        <div className="mt-1 flex flex-col gap-1.5">
                          {r.topsEntries.map((v, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="w-14 text-xs text-blue-700">Cut {idx + 1}</span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={v}
                                onChange={(e) => updateTopsEntry(r.sku, idx, e.target.value)}
                                placeholder="ct"
                                className="w-24 rounded-md border border-blue-300 px-2 py-1 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => removeTopsEntry(r.sku, idx)}
                                className="text-xs text-blue-400 hover:text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addTopsEntry(r.sku)}
                            className="mt-1 w-fit rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                          >
                            + Add tops weight
                          </button>
                          {r.topsEntries.length > 0 && (
                            <p className="mt-1 text-xs text-blue-700">
                              {r.startingWeight ?? 0} ct − {sumTops(r.topsEntries).toFixed(2)} ct tops ={" "}
                              <span className="font-medium">{r.weight} ct final</span>
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <button
        type="submit"
        disabled={isPending || rows.length === 0}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Returning..." : `Return ${rows.length || ""} stone${rows.length === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}
