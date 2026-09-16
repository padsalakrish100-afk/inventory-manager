"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueStones } from "../actions";
import { PROCESS_OPTIONS, PROCESS_LABELS } from "@/lib/process";

type Rate = { partyName: string; process: string; ratePerCarat: number };

type Row = {
  sku: string;
  weight: string;
  laborCost: string;
  laborCostOverridden: boolean;
  reissueReason: string;
  completedProcesses: string[];
};

export function IssueForm({ partyNames, rates }: { partyNames: string[]; rates: Rate[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [process, setProcess] = useState(PROCESS_OPTIONS[0].value);
  const [party, setParty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);

  function currentRate(partyName: string, proc: string): number | null {
    return rates.find((r) => r.partyName === partyName && r.process === proc)?.ratePerCarat ?? null;
  }

  function recomputeLaborCost(row: Row, proc: string, partyName: string): Row {
    if (row.laborCostOverridden) return row;
    const rate = currentRate(partyName, proc);
    const weight = Number(row.weight);
    if (rate === null || !weight) return { ...row, laborCost: "" };
    return { ...row, laborCost: (rate * weight).toFixed(2) };
  }

  async function addScan() {
    const sku = scanValue.trim();
    if (!sku) return;
    setScanValue("");
    if (rows.some((r) => r.sku === sku)) return;

    let completedProcesses: string[] = [];
    let weight = "";
    try {
      const res = await fetch(`/api/stones/${encodeURIComponent(sku)}/history`);
      if (res.ok) {
        const data = await res.json();
        completedProcesses = data.completedProcesses ?? [];
        if (data.caratWeight !== null && data.caratWeight !== undefined) {
          weight = String(data.caratWeight);
        }
      }
    } catch {
      // Lookup failing just means no reissue check or weight prefill happens
      // client-side — the server still enforces the reissue check at submit time.
    }

    setRows((prev) => [
      ...prev,
      recomputeLaborCost(
        { sku, weight, laborCost: "", laborCostOverridden: false, reissueReason: "", completedProcesses },
        process,
        party,
      ),
    ]);
  }

  function removeRow(sku: string) {
    setRows((prev) => prev.filter((r) => r.sku !== sku));
  }

  function updateWeight(sku: string, weight: string) {
    setRows((prev) =>
      prev.map((r) => (r.sku === sku ? recomputeLaborCost({ ...r, weight }, process, party) : r)),
    );
  }

  function updateLaborCost(sku: string, laborCost: string) {
    setRows((prev) => prev.map((r) => (r.sku === sku ? { ...r, laborCost, laborCostOverridden: true } : r)));
  }

  function updateReissueReason(sku: string, reissueReason: string) {
    setRows((prev) => prev.map((r) => (r.sku === sku ? { ...r, reissueReason } : r)));
  }

  function changeProcess(nextProcess: string) {
    setProcess(nextProcess as typeof process);
    setRows((prev) => prev.map((r) => recomputeLaborCost(r, nextProcess, party)));
  }

  function changeParty(nextParty: string) {
    setParty(nextParty);
    setRows((prev) => prev.map((r) => recomputeLaborCost(r, process, nextParty)));
  }

  function submit(formData: FormData) {
    setError(null);
    const date = String(formData.get("date") ?? today);
    const notes = String(formData.get("notes") ?? "");

    const missingReason = rows.find(
      (r) => r.completedProcesses.includes(process) && !r.reissueReason.trim(),
    );
    if (missingReason) {
      setError(`Stone "${missingReason.sku}" already completed ${PROCESS_LABELS[process]} before — give a reissue reason.`);
      return;
    }

    startTransition(async () => {
      const result = await issueStones({
        process,
        party,
        date,
        notes,
        stones: rows.map((r) => ({
          sku: r.sku,
          weight: r.weight,
          laborCost: r.laborCost,
          reissueReason: r.completedProcesses.includes(process) ? r.reissueReason : "",
        })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.memoId) router.push(`/manufacturing/memo/${result.memoId}`);
    });
  }

  const totalWeight = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
  const totalLaborCost = rows.reduce((sum, r) => sum + (Number(r.laborCost) || 0), 0);

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
            onChange={(e) => changeProcess(e.target.value)}
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
            Party (karigar)
          </label>
          <input
            id="party"
            value={party}
            onChange={(e) => changeParty(e.target.value)}
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
          {party && currentRate(party, process) !== null && (
            <p className="mt-1 text-xs text-zinc-500">
              Current rate: ₹{currentRate(party, process)!.toFixed(2)}/ct for {PROCESS_LABELS[process]}
            </p>
          )}
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
              <th className="px-4 py-2 font-medium">Labor cost (₹)</th>
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
              const isReissue = r.completedProcesses.includes(process);
              return (
                <Fragment key={r.sku}>
                  <tr className={isReissue ? "border-b-0" : "border-b border-zinc-100 last:border-0"}>
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
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.laborCost}
                        onChange={(e) => updateLaborCost(r.sku, e.target.value)}
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
                  {isReissue && (
                    <tr className="border-b border-zinc-100 last:border-0 bg-amber-50">
                      <td></td>
                      <td colSpan={4} className="px-4 pb-2">
                        <label className="block text-xs font-medium text-amber-700">
                          Already completed {PROCESS_LABELS[process]} before — why is it going again?
                        </label>
                        <input
                          type="text"
                          value={r.reissueReason}
                          onChange={(e) => updateReissueReason(r.sku, e.target.value)}
                          placeholder="e.g. re-cut requested, symmetry off"
                          className="mt-1 w-full rounded-md border border-amber-300 px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50">
                <td colSpan={2} className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {rows.length} stone{rows.length === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-2 font-medium text-zinc-900">{totalWeight.toFixed(2)} ct</td>
                <td className="px-4 py-2 font-medium text-zinc-900">₹{totalLaborCost.toFixed(2)}</td>
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
