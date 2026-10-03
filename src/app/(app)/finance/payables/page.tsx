import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { openPayables } from "@/lib/sales/balances";
import { SalesNav } from "../../sales/sales-nav";
import { AgeingReport } from "../ageing-table";

// Purchase amounts are costs (rough price), so payables need cost visibility.
export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ party?: string; kind?: string }> }) {
  const viewer = await requirePagePermission("costs.view");
  const sp = await searchParams;
  const all = await openPayables(prisma);
  const parties = [...new Map(all.map((d) => [d.partyId, d.partyName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const docs = all.filter((d) => (!sp.party || d.partyId === sp.party) && (!sp.kind || d.kind === sp.kind));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Payables</h1>
          <p className="mt-1 text-sm text-zinc-500">
            What we owe: rough purchases, job-work bills and brokerage, by age. Karigar pay is settled in Payroll.
          </p>
        </div>
        <SalesNav viewer={viewer} current="/finance/payables" />
      </div>
      <form className="flex flex-wrap items-end gap-2">
        <select name="kind" defaultValue={sp.kind ?? ""} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm">
          <option value="">Everything</option>
          <option value="ROUGH">Rough purchases</option>
          <option value="JOB_WORK">Job-work bills</option>
          <option value="BROKERAGE">Brokerage</option>
        </select>
        <select name="party" defaultValue={sp.party ?? ""} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm">
          <option value="">All parties</option>
          {parties.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50">Show</button>
      </form>
      <AgeingReport docs={docs} payHref={(d) => `/sales/payments/new?direction=OUT&party=${d.partyId}&currency=${d.currency}`} />
    </div>
  );
}
