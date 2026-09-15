import { prisma } from "@/lib/prisma";
import { PartyForm } from "./party-form";
import { DeletePartyButton } from "./delete-button";

const typeLabel: Record<string, string> = {
  SUPPLIER: "Supplier",
  CUSTOMER: "Customer",
  BOTH: "Supplier & customer",
};

export default async function PartiesPage() {
  const parties = await prisma.party.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Suppliers & customers</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Contacts you buy from or sell to. Reuse them when recording a transaction.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {parties.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No contacts yet.
                  </td>
                </tr>
              )}
              {parties.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-zinc-900">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{typeLabel[p.type]}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <DeletePartyButton partyId={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Add contact</h2>
          <div className="mt-4">
            <PartyForm />
          </div>
        </div>
      </div>
    </div>
  );
}
