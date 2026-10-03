import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { openReceivables } from "@/lib/sales/balances";
import { SalesNav } from "../../sales/sales-nav";
import { AgeingReport } from "../ageing-table";

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ party?: string }> }) {
  const viewer = await requirePagePermission("sales.manage");
  const sp = await searchParams;
  const all = await openReceivables(prisma);
  const parties = [...new Map(all.map((d) => [d.partyId, d.partyName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const docs = sp.party ? all.filter((d) => d.partyId === sp.party) : all;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Receivables</h1>
          <p className="mt-1 text-sm text-zinc-500">What customers owe, by invoice and by age (days since the invoice date).</p>
        </div>
        <SalesNav viewer={viewer} current="/finance/receivables" />
      </div>
      {parties.length > 1 && (
        <form className="flex flex-wrap items-end gap-2">
          <select name="party" defaultValue={sp.party ?? ""} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm">
            <option value="">All customers</option>
            {parties.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <button className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-50">Show</button>
        </form>
      )}
      <AgeingReport docs={docs} payHref={(d) => `/sales/payments/new?direction=IN&party=${d.partyId}&currency=${d.currency}`} />
    </div>
  );
}
