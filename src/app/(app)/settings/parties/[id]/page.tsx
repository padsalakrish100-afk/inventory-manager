import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { PARTY_ROLE_LABELS, PARTY_ROLE_STYLES } from "@/lib/party-category";
import { EditPartyForm } from "./edit-party-form";
import { ActiveToggleButton } from "../active-toggle-button";

export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("admin");

  const { id } = await params;
  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) notFound();

  const taxIds = (party.taxIds ?? {}) as Record<string, string | undefined>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-900">{party.name}</h1>
            {party.roles.map((r) => (
              <span key={r} className={`rounded-full px-2.5 py-1 text-xs font-medium ${PARTY_ROLE_STYLES[r]}`}>
                {PARTY_ROLE_LABELS[r]}
              </span>
            ))}
            {!party.active && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
                Inactive
              </span>
            )}
          </div>
          <Link href="/settings/parties" className="mt-1 inline-block text-sm text-zinc-500 hover:underline">
            &larr; All parties
          </Link>
        </div>
        <ActiveToggleButton partyId={party.id} active={party.active} />
      </div>

      <section className="max-w-2xl">
        <EditPartyForm
          id={party.id}
          defaults={{
            roles: party.roles,
            companyName: party.companyName,
            contactPerson: party.contactPerson,
            country: party.country,
            phone: party.phone,
            email: party.email,
            address: party.address,
            gstin: taxIds.gstin ?? null,
            pan: taxIds.pan ?? null,
            taxOther: taxIds.other ?? null,
            creditLimit: party.creditLimit?.toString() ?? null,
            creditCurrency: party.creditCurrency,
            notes: party.notes,
          }}
        />
      </section>

      {(party.roles.includes("KARIGAR") || party.roles.includes("JOB_WORKER")) && (
        <section className="max-w-2xl rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Rate cards, labour &amp; payroll</h2>
          <p className="mt-1 text-sm text-zinc-500">Managed on the karigar&apos;s own page.</p>
          <Link
            href={party.roles.includes("KARIGAR") ? `/karigars/${party.id}` : "/job-work"}
            className="mt-3 inline-flex min-h-10 items-center rounded-md border border-zinc-300 px-4 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            {party.roles.includes("KARIGAR") ? "Open karigar page" : "Open job-work"}
          </Link>
        </section>
      )}
    </div>
  );
}
