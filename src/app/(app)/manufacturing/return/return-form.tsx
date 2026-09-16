"use client";

import { useRef, useState, useTransition } from "react";
import { returnStones } from "../actions";
import { PROCESS_LABELS } from "@/lib/process";

type StoneInfo = { sku: string; weight: string; process?: string; party?: string };

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
    const weight = info.caratWeight !== null && info.caratWeight !== undefined ? String(info.caratWeight) : "";
    setRows((prev) => [
      ...prev,
      { sku, weight, process: info.process, party: info.party },
    ]);
  }

  function removeRow(sku: string) {
    setRows((prev) => prev.filter((r) => r.sku !== sku));
  }

  function updateWeight(sku: string, weight: string) {
    setRows((prev) => prev.map((r) => (r.sku === sku ? { ...r, weight } : r)));
  }

  function submit(formData: FormData) {
    setError(null);
    setMessage(null);
    const date = String(formData.get("date") ?? today);
    const notes = String(formData.get("notes") ?? "");
    startTransition(async () => {
      const result = await returnStones({ date, notes, stones: rows });
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
            {rows.map((r, i) => (
              <tr key={r.sku} className="border-b border-zinc-100 last:border-0">
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
            ))}
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
