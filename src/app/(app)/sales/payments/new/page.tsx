import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, getViewer, homePathFor } from "@/lib/authz";
import { formatDate, todayIST } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { openPayables, openReceivables } from "@/lib/sales/balances";
import { PaymentForm } from "./payment-form";

type Search = { direction?: string; party?: string; currency?: string };

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const sp = await searchParams;
  const direction = sp.direction === "OUT" ? "OUT" : "IN";
  const allowed = direction === "OUT" ? can(viewer, "costs.view") : can(viewer, "sales.manage");
  if (!allowed) redirect(homePathFor(viewer));

  const open = direction === "IN" ? await openReceivables(prisma) : await openPayables(prisma);
  // Parties with something open first, then everyone with the right role.
  const owing = new Map<string, { name: string; count: number }>();
  for (const d of open) owing.set(d.partyId, { name: d.partyName, count: (owing.get(d.partyId)?.count ?? 0) + 1 });
  const others = await prisma.party.findMany({
    where: {
      active: true,
      id: { notIn: [...owing.keys()] },
      roles: { hasSome: direction === "IN" ? ["CUSTOMER"] : ["VENDOR", "JOB_WORKER", "BROKER"] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const party = sp.party ? await prisma.party.findUnique({ where: { id: sp.party }, select: { id: true, name: true } }) : null;
  const docs = party ? open.filter((d) => d.partyId === party.id) : [];
  const title = direction === "IN" ? "Record receipt" : "Record payment out";

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {direction === "IN" ? "Money received from a customer, set against their invoices." : "Money paid to a vendor, job-worker or broker, set against what we owe."}
        </p>
        <Link href="/sales/payments" className="text-sm text-zinc-500 hover:underline">
          &larr; Payments
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <input type="hidden" name="direction" value={direction} />
        <label className="min-w-0 flex-1 text-sm font-medium text-zinc-700">
          {direction === "IN" ? "Customer" : "Pay to"}
          <select name="party" defaultValue={party?.id ?? ""} required className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base sm:text-sm">
            <option value="" disabled>
              Choose…
            </option>
            {owing.size > 0 && (
              <optgroup label="With open documents">
                {[...owing.entries()].map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="Others">
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <button className="min-h-11 rounded-md border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50">{party ? "Change" : "Next"}</button>
      </form>

      {party && (
        <PaymentForm
          direction={direction}
          partyId={party.id}
          partyName={party.name}
          today={todayIST()}
          defaultCurrency={sp.currency === "INR" || sp.currency === "USD" ? sp.currency : (docs[0]?.currency ?? "USD")}
          docs={docs.map((d) => ({
            key: `${d.kind}:${d.id}`,
            kind: d.kind,
            id: d.id,
            ref: d.ref,
            date: formatDate(d.date),
            currency: d.currency,
            outstanding: (d.outstandingCents / 100).toFixed(2),
            outstandingLabel: formatMoney(d.outstandingCents / 100, d.currency),
          }))}
        />
      )}
    </div>
  );
}
