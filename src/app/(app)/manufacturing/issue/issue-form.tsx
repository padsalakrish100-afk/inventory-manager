"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueStones } from "../actions";
import { PROCESS_OPTIONS } from "@/lib/process";

type Row = { sku: string; weight: string };

export function IssueForm({ partyNames }: { partyNames: string[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [process, setProcess] = useState(PROCESS_OPTIONS[0].value);
  const [party, setParty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);

  function addScan() {
    const sku = scanValue.trim();
    if (!sku) return;
    setScanValue("");
    setRows((prev) => {
      if (prev.some((r) => r.sku === sku)) return prev;
      return [...prev, { sku, weight: "" }];
    });
  }

  function removeRow(sku: string) {
    setRows((prev) => prev.filter((r) => r.sku !== sku));
  }

  function updateWeight(sku: string, weight: string) {
    setRows((prev) => prev.map((r) => (r.sku === sku ? { ...r, weight } : r)));
  }

  function submit(formData: FormData) {
    setError(null);
    const date = String(formData.get("date") ?? today);
    const notes = String(formData.get("notes") ?? "");
    startTransition(async () => {
      const result = await issueStones({ process, party, date, notes, stones: rows });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.memoId) router.push(`/manufacturing/memo/${result.memoId}`);
    });
  }

  const totalWeight = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  return (
    <form action={submit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="process" className="block text-sm font-medium text-zinc-700">
            Process
          </label>
          <select
            id="process"
            value={process}
            onChange={(e) => setProcess(e.target.value as typeof process)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            {PROCESS_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="party" className="block text-sm font-medium text-zinc-700">
            Party (karigar / vendor)
          </label>
          <input
            id="party"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            type="text"
            list="issue-party-suggestions"
            required
            placeholder="e.g. Rajesh Sawing Works"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <datalist id="issue-party-suggestions">
            {partyNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
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
          placeholder="Click here, then scan each stone's barcode"
          className="mt-1 w-full rounded-md border border-zinc-300 px-4 py-3 text-lg focus:border-zinc-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Each scan adds a row below. Fix or fill in a weight by hand if needed.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Stone number</th>
              <th className="px-4 py-2 font-medium">Weight (ct)</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No stones scanned yet.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.sku} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2 text-zinc-500">{i + 1}</td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-800">{r.sku}</td>
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
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50">
                <td colSpan={2} className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {rows.length} stone{rows.length === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-2 font-medium text-zinc-900">{totalWeight.toFixed(2)} ct</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || rows.length === 0}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Issuing..." : `Issue ${rows.length || ""} stone${rows.length === 1 ? "" : "s"} & print memo`}
      </button>
    </form>
  );
}
