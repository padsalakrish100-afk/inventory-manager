import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PARTY_CATEGORY_LABELS, PARTY_CATEGORY_STYLES } from "@/lib/party-category";
import { PROCESS_LABELS } from "@/lib/process";
import { EditPartyForm } from "./edit-party-form";
import { ActiveToggleButton } from "../active-toggle-button";
import { RateForm } from "./rate-form";
import { DeleteRateButton } from "./delete-rate-button";

export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/manufacturing");

  const { id } = await params;
  const party = await prisma.party.findUnique({
    where: { id },
    include: {
      processRates: { where: { process: { not: null } }, orderBy: [{ process: "asc" }, { effectiveFrom: "desc" }] },
    },
  });
  if (!party) notFound();

  const now = new Date();
  const currentRateByProcess = new Map<string, (typeof party.processRates)[number]>();
  for (const rate of party.processRates) {
    if (!rate.process || rate.effectiveFrom > now) continue;
    const existing = currentRateByProcess.get(rate.process);
    if (!existing || rate.effectiveFrom > existing.effectiveFrom) {
      currentRateByProcess.set(rate.process, rate);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-900">{party.name}</h1>
            {party.category && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PARTY_CATEGORY_STYLES[party.category]}`}>
                {PARTY_CATEGORY_LABELS[party.category]}
              </span>
            )}
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

      <section className="max-w-md">
        <EditPartyForm
          id={party.id}
          defaults={{
            category: party.category,
            phone: party.phone,
            email: party.email,
            address: party.address,
            notes: party.notes,
          }}
        />
      </section>

      {party.category === "KARIGAR" && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Process rates</h2>
            <p className="mt-1 text-sm text-zinc-500">
              What this karigar charges per carat, by process. Adding a new rate for a process
              doesn't erase the old one — Manufacturing issues already recorded keep showing the
              labor cost they were actually charged.
            </p>
          </div>

          {currentRateByProcess.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...currentRateByProcess.entries()].map(([process, rate]) => (
                <span key={process} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                  {PROCESS_LABELS[process]}: ₹{rate.ratePerCarat.toFixed(2)}/ct
                </span>
              ))}
            </div>
          )}

          <RateForm partyId={party.id} />

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Process</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">Effective from</th>
                  <th className="px-4 py-3 font-medium"></th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {party.processRates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                      No rates saved yet.
                    </td>
                  </tr>
                )}
                {party.processRates.map((rate) => {
                  const isCurrent = rate.process ? currentRateByProcess.get(rate.process)?.id === rate.id : false;
                  return (
                    <tr key={rate.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3 text-zinc-900">{rate.process ? PROCESS_LABELS[rate.process] : "—"}</td>
                      <td className="px-4 py-3 text-zinc-800">₹{rate.ratePerCarat.toFixed(2)}/ct</td>
                      <td className="px-4 py-3 text-zinc-500">{rate.effectiveFrom.toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {isCurrent && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DeleteRateButton rateId={rate.id} partyId={party.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
