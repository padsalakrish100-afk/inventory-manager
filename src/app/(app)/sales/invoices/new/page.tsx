import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { todayIST } from "@/lib/dates";
import { customerNames, pickableStones } from "@/lib/sales/pickable";
import { documentSettings, todayPlusDays } from "@/lib/sales/company";
import { InvoiceForm } from "./invoice-form";

type Search = { memo?: string; stones?: string; stone?: string };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission("sales.manage");
  const sp = await searchParams;
  const [stones, customers, brokers, settings, memo] = await Promise.all([
    pickableStones({ includeOnMemo: true }),
    customerNames(),
    prisma.party.findMany({ where: { roles: { has: "BROKER" }, active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    documentSettings(),
    sp.memo ? prisma.salesMemo.findUnique({ where: { id: sp.memo }, select: { currency: true, fxRate: true, party: { select: { name: true, address: true, country: true } } } }) : null,
  ]);
  const initial = (sp.stones ?? sp.stone ?? "").split(",").filter(Boolean).slice(0, 200);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">New invoice</h1>
        <p className="mt-1 text-sm text-zinc-500">Sell stones in stock, or stones on memo with this customer.</p>
        <Link href="/sales/invoices" className="text-sm text-zinc-500 hover:underline">
          &larr; Invoices
        </Link>
      </div>
      <InvoiceForm
        stones={stones}
        customers={customers}
        brokers={brokers.map((b) => b.name)}
        initialStones={initial}
        defaults={{
          party: memo?.party.name ?? "",
          currency: memo?.currency ?? "USD",
          date: todayIST(),
          dueDate: todayPlusDays(settings.invoiceDueDays),
          shipToName: memo?.party.name ?? "",
          shipToAddress: memo?.party.address ?? "",
          shipToCountry: memo?.party.country ?? "",
        }}
      />
    </div>
  );
}
