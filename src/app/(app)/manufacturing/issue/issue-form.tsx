"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueStones } from "../actions";
import { parseScannedCode } from "@/lib/stone/scan";
import { todayIST } from "@/lib/dates";

type Rate = { partyName: string; process: string; ratePerCarat: number };
type StageOption = { id: string; name: string; legacyProcess: string | null; departmentId: string | null };

type Row = {
  sku: string;
  weight: string;
  pieces: string;
  laborCost: string;
  laborCostOverridden: boolean;
  reissueReason: string;
  completedStageIds: string[];
};

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-500 focus:outline-none sm:py-2 sm:text-sm";

export function IssueForm({
  partyNames,
  rates,
  stages,
  departments,
  showLabour,
  initialSku,
}: {
  partyNames: string[];
  rates: Rate[];
  // Only the stages this user may issue to (operators: their departments).
  stages: StageOption[];
  departments: { id: string; name: string }[];
  // Labour cost is a cost — hidden (and worked out on the server) for people
  // who can't see costs.
  showLabour: boolean;
  initialSku?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [target, setTarget] = useState<"KARIGAR" | "DEPARTMENT">("KARIGAR");
  const [party, setParty] = useState("");
  const [toDepartmentId, setToDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const today = todayIST();
  const stage = stages.find((s) => s.id === stageId);

  function currentRate(partyName: string, st: StageOption | undefined): number | null {
    if (!st?.legacyProcess || !partyName) return null;
    return rates.find((r) => r.partyName === partyName && r.process === st.legacyProcess)?.ratePerCarat ?? null;
  }

  function recomputeLaborCost(row: Row, st: StageOption | undefined, partyName: string, tgt: string): Row {
    if (row.laborCostOverridden) return row;
    const rate = tgt === "KARIGAR" ? currentRate(partyName, st) : null;
    const weight = Number(row.weight);
    if (rate === null || !weight) return { ...row, laborCost: "" };
    return { ...row, laborCost: (rate * weight).toFixed(2) };
  }

  async function addScan(raw: string = scanValue) {
    const sku = parseScannedCode(raw);
    if (!sku) return;
    setScanValue("");
    setError(null);
    if (rows.some((r) => r.sku === sku)) return;

    let completedStageIds: string[] = [];
    let weight = "";
    try {
      const res = await fetch(`/api/stones/${encodeURIComponent(sku)}/history`);
      if (res.status === 404) {
        setError(`Stone "${sku}" not found.`);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.isOut) {
          setError(`Stone "${sku}" is already out — return it first.`);
          return;
        }
        completedStageIds = data.completedStageIds ?? [];
        if (data.caratWeight !== null && data.caratWeight !== undefined) weight = String(data.caratWeight);
      }
    } catch {
      // Lookup failing just means no prefill/reissue hint here — the server
      // still checks everything at submit time.
    }

    setRows((prev) => [
      ...prev,
      recomputeLaborCost(
        { sku, weight, pieces: "1", laborCost: "", laborCostOverridden: false, reissueReason: "", completedStageIds },
        stage,
        party,
        target,
      ),
    ]);
    scanRef.current?.focus();
  }

  // Opened from a stone's page ("Issue" quick action): start with that stone.
  const initialAdded = useRef(false);
  useEffect(() => {
    if (initialSku && !initialAdded.current) {
      initialAdded.current = true;
      void addScan(initialSku);
    }
    // Runs once for the stone passed in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSku]);

  function updateRow(sku: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.sku !== sku) return r;
        const next = { ...r, ...patch };
        return "weight" in patch ? recomputeLaborCost(next, stage, party, target) : next;
      }),
    );
  }

  function changeStage(nextId: string) {
    setStageId(nextId);
    const nextStage = stages.find((s) => s.id === nextId);
    setRows((prev) => prev.map((r) => recomputeLaborCost(r, nextStage, party, target)));
  }

  function changeParty(nextParty: string) {
    setParty(nextParty);
    setRows((prev) => prev.map((r) => recomputeLaborCost(r, stage, nextParty, target)));
  }

  function changeTarget(next: "KARIGAR" | "DEPARTMENT") {
    setTarget(next);
    setRows((prev) => prev.map((r) => recomputeLaborCost(r, stage, party, next)));
  }

  function submit(formData: FormData) {
    setError(null);
    const missingReason = rows.find((r) => r.completedStageIds.includes(stageId) && !r.reissueReason.trim());
    if (missingReason) {
      setError(`Stone "${missingReason.sku}" already completed ${stage?.name} before — give a reissue reason.`);
      return;
    }

    startTransition(async () => {
      const result = await issueStones({
        stageId,
        target,
        party,
        toDepartmentId,
        fromDepartmentId: String(formData.get("fromDepartmentId") ?? ""),
        date: String(formData.get("date") ?? today),
        notes: String(formData.get("notes") ?? ""),
        stones: rows.map((r) => ({
          sku: r.sku,
          weight: r.weight,
          pieces: r.pieces,
          laborCost: showLabour ? r.laborCost : "",
          reissueReason: r.completedStageIds.includes(stageId) ? r.reissueReason : "",
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
  const totalPieces = rows.reduce((sum, r) => sum + (Number(r.pieces) || 0), 0);
  const totalLaborCost = rows.reduce((sum, r) => sum + (Number(r.laborCost) || 0), 0);
  const rate = target === "KARIGAR" ? currentRate(party, stage) : null;

  return (
    <form action={submit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="stage" className="block text-sm font-medium text-zinc-700">
            Process stage
          </label>
          <select id="stage" value={stageId} onChange={(e) => changeStage(e.target.value)} className={inputClass}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-sm font-medium text-zinc-700">Issue to</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(["KARIGAR", "DEPARTMENT"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeTarget(t)}
                className={`min-h-11 rounded-md border px-3 text-sm font-medium ${
                  target === t ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
                }`}
              >
                {t === "KARIGAR" ? "Karigar" : "Department"}
              </button>
            ))}
          </div>
        </div>

        {target === "KARIGAR" ? (
          <div>
            <label htmlFor="party" className="block text-sm font-medium text-zinc-700">
              Karigar
            </label>
            <input
              id="party"
              value={party}
              onChange={(e) => changeParty(e.target.value)}
              type="text"
              list="issue-party-suggestions"
              placeholder="e.g. Rajesh Sawing Works"
              className={inputClass}
            />
            <datalist id="issue-party-suggestions">
              {partyNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {showLabour && rate !== null && (
              <p className="mt-1 text-xs text-zinc-500">
                Current rate: ₹{rate.toFixed(2)}/ct for {stage?.name}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="toDepartmentId" className="block text-sm font-medium text-zinc-700">
              Department
            </label>
            <select
              id="toDepartmentId"
              value={toDepartmentId}
              onChange={(e) => setToDepartmentId(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="fromDepartmentId" className="block text-sm font-medium text-zinc-700">
            From department
          </label>
          <select id="fromDepartmentId" name="fromDepartmentId" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

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
          placeholder="Tap here, then scan each stone"
          className="mt-1 min-h-12 w-full rounded-md border border-zinc-300 px-4 py-3 text-lg focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No stones scanned yet.
          </p>
        )}
        {rows.map((r, i) => {
          const isReissue = r.completedStageIds.includes(stageId);
          return (
            <div
              key={r.sku}
              className={`rounded-lg border bg-white p-3 ${isReissue ? "border-amber-300" : "border-zinc-200"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-sm text-zinc-900">
                  <span className="text-zinc-400">{i + 1}.</span> {r.sku}
                </p>
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((x) => x.sku !== r.sku))}
                  className="min-h-10 px-2 text-sm text-zinc-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
              <div className={`mt-2 grid gap-2 ${showLabour ? "grid-cols-3" : "grid-cols-2"}`}>
                <label className="text-xs text-zinc-500">
                  Weight (ct)
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.001"
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
                {showLabour && (
                  <label className="text-xs text-zinc-500">
                    Labour (₹)
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={r.laborCost}
                      onChange={(e) => updateRow(r.sku, { laborCost: e.target.value, laborCostOverridden: true })}
                      className={inputClass}
                    />
                  </label>
                )}
              </div>
              {isReissue && (
                <label className="mt-2 block text-xs font-medium text-amber-700">
                  Already completed {stage?.name} before — why is it going again?
                  <input
                    type="text"
                    value={r.reissueReason}
                    onChange={(e) => updateRow(r.sku, { reissueReason: e.target.value })}
                    placeholder="e.g. re-cut requested, symmetry off"
                    className="mt-1 w-full rounded-md border border-amber-300 px-3 py-2 text-base sm:text-sm"
                  />
                </label>
              )}
            </div>
          );
        })}
        {rows.length > 0 && (
          <p className="text-sm text-zinc-600">
            {rows.length} stone{rows.length === 1 ? "" : "s"} · {totalPieces} pc · {totalWeight.toFixed(3)} ct
            {showLabour && totalLaborCost > 0 ? ` · ₹${totalLaborCost.toFixed(2)} labour` : ""}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || rows.length === 0 || !stageId}
        className="min-h-12 w-full rounded-md bg-[var(--accent)] px-4 py-3 text-base font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Issuing..." : `Issue ${rows.length || ""} stone${rows.length === 1 ? "" : "s"} & print memo`}
      </button>
    </form>
  );
}
