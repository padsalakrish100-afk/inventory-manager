"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { returnStones } from "../actions";
import { parseScannedCode } from "@/lib/stone/scan";
import { todayIST } from "@/lib/dates";
import { computeLoss, isOverLimit } from "@/lib/manufacturing/loss";
import { RETURN_CONDITIONS, RETURN_CONDITION_LABELS } from "@/lib/manufacturing/conditions";

type Row = {
  sku: string;
  stage: string | null;
  party: string | null;
  isSawing: boolean;
  issueWeight: number | null;
  issuePieces: number;
  lossLimitPct: string | null;
  weight: string;
  pieces: string;
  condition: string;
  remark: string;
  excessReason: string;
  topsEntries: string[];
};

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

function sumTops(entries: string[]): number {
  return entries.reduce((sum, e) => sum + (Number(e) || 0), 0);
}

// For sawing, cutting off tops lowers the stone's weight by exactly the tops
// removed — so the return weight follows the tops until it's typed by hand.
function recomputeWeightFromTops(row: Row): Row {
  if (!row.isSawing || row.topsEntries.length === 0 || row.issueWeight === null) return row;
  const remaining = row.issueWeight - sumTops(row.topsEntries);
  return { ...row, weight: (remaining >= 0 ? remaining : 0).toFixed(3) };
}

function lossOf(row: Row) {
  if (row.issueWeight === null || row.weight === "" || Number.isNaN(Number(row.weight))) return null;
  const tops = row.topsEntries.length > 0 ? sumTops(row.topsEntries) : null;
  const loss = computeLoss(row.issueWeight, row.weight, tops);
  return { ...loss, excess: isOverLimit(loss.lossPct, row.lossLimitPct) };
}

export function ReturnForm({ initialSku }: { initialSku?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);

  const today = todayIST();

  async function addScan(raw: string = scanValue) {
    const sku = parseScannedCode(raw);
    if (!sku) return;
    setScanValue("");
    setError(null);
    setMessage(null);
    if (rows.some((r) => r.sku === sku)) return;

    const res = await fetch(`/api/stones/${encodeURIComponent(sku)}`);
    if (!res.ok) {
      setError(`Stone "${sku}" not found or not currently issued anywhere.`);
      return;
    }
    const info = await res.json();
    const issueWeight = info.issueWeight !== null && info.issueWeight !== undefined ? Number(info.issueWeight) : null;
    setRows((prev) => [
      ...prev,
      {
        sku,
        stage: info.stage,
        party: info.party,
        isSawing: Boolean(info.isSawing),
        issueWeight,
        issuePieces: info.issuePieces ?? 1,
        lossLimitPct: info.lossLimitPct ?? null,
        // Prefilled with the stone's recorded weight (as before); the
        // weigher corrects it, and the loss line updates as they type.
        weight: info.caratWeight !== null && info.caratWeight !== undefined ? String(info.caratWeight) : "",
        pieces: String(info.issuePieces ?? 1),
        condition: "OK",
        remark: "",
        excessReason: "",
        topsEntries: [],
      },
    ]);
    scanRef.current?.focus();
  }

  // Opened from a stone's page ("Return" quick action): start with that stone.
  const initialAdded = useRef(false);
  useEffect(() => {
    if (initialSku && !initialAdded.current) {
      initialAdded.current = true;
      void addScan(initialSku);
    }
    // Runs once for the stone passed in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSku]);

  function updateRow(sku: string, patch: Partial<Row>, fromTops = false) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.sku !== sku) return r;
        const next = { ...r, ...patch };
        return fromTops ? recomputeWeightFromTops(next) : next;
      }),
    );
  }

  function submit(formData: FormData) {
    setError(null);
    setMessage(null);
    const missingWeight = rows.find((r) => r.weight === "");
    if (missingWeight) {
      setError(`Enter the return weight for "${missingWeight.sku}".`);
      return;
    }
    const missingReason = rows.find((r) => lossOf(r)?.excess && !r.excessReason.trim());
    if (missingReason) {
      setError(`"${missingReason.sku}" is over the allowed loss — give a reason before saving.`);
      return;
    }

    startTransition(async () => {
      const result = await returnStones({
        date: String(formData.get("date") ?? today),
        notes: String(formData.get("notes") ?? ""),
        stones: rows.map((r) => ({
          sku: r.sku,
          weight: r.weight,
          pieces: r.pieces,
          condition: r.condition,
          remark: r.remark,
          topsWeight: r.topsEntries.length > 0 ? sumTops(r.topsEntries).toFixed(3) : "",
          excessReason: lossOf(r)?.excess ? r.excessReason : "",
        })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Returned ${result.returned} stone${result.returned === 1 ? "" : "s"}.` +
          (result.excess ? ` ${result.excess} flagged for excess loss.` : ""),
      );
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
          <input id="date" name="date" type="date" defaultValue={today} className={inputClass} />
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
            Notes
          </label>
          <input id="notes" name="notes" type="text" placeholder="Optional" className={inputClass} />
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
              void addScan();
            }
          }}
          placeholder="Tap here, then scan each returning stone"
          className="mt-1 min-h-12 w-full rounded-md border border-zinc-300 px-4 py-3 text-lg focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No stones scanned yet.
          </p>
        )}
        {rows.map((r, i) => {
          const loss = lossOf(r);
          return (
            <div
              key={r.sku}
              className={`rounded-lg border bg-white p-3 ${loss?.excess ? "border-red-400 ring-1 ring-red-200" : "border-zinc-200"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-zinc-900">
                    <span className="text-zinc-400">{i + 1}.</span> {r.sku}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {r.stage ?? "—"}
                    {r.party ? ` · ${r.party}` : ""} · issued {r.issueWeight ?? "—"} ct
                    {r.issuePieces > 1 ? ` · ${r.issuePieces} pc` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((x) => x.sku !== r.sku))}
                  className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs text-zinc-500">
                  Return wt (ct)
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.001"
                    required
                    value={r.weight}
                    onChange={(e) => updateRow(r.sku, { weight: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Pieces
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step="1"
                    value={r.pieces}
                    onChange={(e) => updateRow(r.sku, { pieces: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Condition
                  <select
                    value={r.condition}
                    onChange={(e) => updateRow(r.sku, { condition: e.target.value })}
                    className={inputClass}
                  >
                    {RETURN_CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {RETURN_CONDITION_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {r.isSawing && (
                <div className="mt-2 rounded-md bg-blue-50 p-2">
                  <p className="text-xs font-medium text-blue-700">Tops removed (cut pieces, recovered)</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {r.topsEntries.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.001"
                          value={v}
                          onChange={(e) =>
                            updateRow(r.sku, { topsEntries: r.topsEntries.map((x, j) => (j === idx ? e.target.value : x)) }, true)
                          }
                          placeholder={`Cut ${idx + 1} ct`}
                          className="min-h-10 w-24 rounded-md border border-blue-300 px-2 text-base sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => updateRow(r.sku, { topsEntries: r.topsEntries.filter((_, j) => j !== idx) }, true)}
                          className="px-1 text-xs text-blue-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateRow(r.sku, { topsEntries: [...r.topsEntries, ""] }, true)}
                      className="min-h-10 rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-100"
                    >
                      + Tops
                    </button>
                  </div>
                  {r.topsEntries.length > 0 && (
                    <p className="mt-1 text-xs text-blue-700">{sumTops(r.topsEntries).toFixed(3)} ct of tops</p>
                  )}
                </div>
              )}

              {loss && (
                <p className={`mt-2 text-sm ${loss.excess ? "font-medium text-red-700" : "text-zinc-600"}`}>
                  Loss {loss.lossWeight} ct
                  {loss.lossPct !== null && ` · ${Number(loss.lossPct).toFixed(2)}%`}
                  {r.lossLimitPct !== null
                    ? ` (allowed ${Number(r.lossLimitPct).toFixed(2)}%)`
                    : " (no limit set)"}
                  {Number(loss.lossWeight) < 0 && " — return weight is more than issued!"}
                </p>
              )}
              {loss?.excess && (
                <label className="mt-2 block text-xs font-medium text-red-700">
                  Over the allowed loss — reason (required)
                  <input
                    type="text"
                    value={r.excessReason}
                    onChange={(e) => updateRow(r.sku, { excessReason: e.target.value })}
                    placeholder="e.g. hidden inclusion opened during sawing"
                    className="mt-1 w-full rounded-md border border-red-300 px-3 py-2 text-base sm:text-sm"
                  />
                </label>
              )}
              <input
                type="text"
                value={r.remark}
                onChange={(e) => updateRow(r.sku, { remark: e.target.value })}
                placeholder="Remark (optional)"
                className="mt-2 min-h-10 w-full rounded-md border border-zinc-200 px-3 text-base sm:text-sm"
              />
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <button
        type="submit"
        disabled={isPending || rows.length === 0}
        className="min-h-12 w-full rounded-md bg-[var(--accent)] px-4 py-3 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Returning..." : `Return ${rows.length || ""} stone${rows.length === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}
