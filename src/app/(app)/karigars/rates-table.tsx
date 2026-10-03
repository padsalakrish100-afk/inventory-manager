import { formatDate } from "@/lib/dates";
import { RATE_BASIS_LABELS } from "@/lib/manufacturing/labour-labels";
import { DeleteRateButton } from "./rate-card-form";

// Rate-card history: the row in force today is marked; older rows are greyed.
export function RatesTable({
  rates,
  currentRateIds,
}: {
  rates: { id: string; effectiveFrom: Date; basis: keyof typeof RATE_BASIS_LABELS; rate: { toString(): string } | null; processStage: { name: string } | null }[];
  currentRateIds: Set<string>;
}) {
  const now = new Date();
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">Stage</th>
            <th className="px-4 py-2 font-medium">Rate</th>
            <th className="px-4 py-2 font-medium">From</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rates.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                No rates yet.
              </td>
            </tr>
          )}
          {rates.map((r) => {
            const current = currentRateIds.has(r.id);
            const upcoming = r.effectiveFrom > now;
            return (
              <tr key={r.id} className={`border-b border-zinc-100 last:border-0 ${current || upcoming ? "" : "text-zinc-400"}`}>
                <td className="px-4 py-2">{r.processStage?.name ?? "—"}</td>
                <td className="px-4 py-2 font-medium">
                  ₹{r.rate?.toString()} {RATE_BASIS_LABELS[r.basis]}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatDate(r.effectiveFrom)}
                  {current && <span className="ml-2 text-xs text-emerald-700">in force</span>}
                  {upcoming && <span className="ml-2 text-xs text-sky-700">upcoming</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  <DeleteRateButton rateId={r.id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
