import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PARTY_CATEGORY_OPTIONS, PARTY_CATEGORY_LABELS, PARTY_CATEGORY_STYLES } from "@/lib/party-category";
import { PartyForm } from "./party-form";
import { ActiveToggleButton } from "./active-toggle-button";
import type { PartyCategory } from "@/generated/prisma/client";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/manufacturing");

  const { category } = await searchParams;
  const validCategory =
    category && (PARTY_CATEGORY_OPTIONS.map((c) => c.value) as string[]).includes(category)
      ? (category as PartyCategory)
      : undefined;

  const parties = await prisma.party.findMany({
    where: { category: validCategory },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Parties</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tenders/vendors, karigars, and customers — categorized so the right list shows up in the
          right dropdown across the app.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500">Category</label>
              <select
                name="category"
                defaultValue={category ?? ""}
                className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {PARTY_CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Filter
            </button>
            {category && (
              <Link href="/settings/parties" className="text-sm text-zinc-500 hover:underline">
                Clear
              </Link>
            )}
          </form>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {parties.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                      No parties yet.
                    </td>
                  </tr>
                )}
                {parties.map((p) => (
                  <tr key={p.id} className={`border-b border-zinc-100 last:border-0 ${p.active ? "" : "opacity-50"}`}>
                    <td className="px-4 py-3">
                      <Link href={`/settings/parties/${p.id}`} className="font-medium text-zinc-900 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.category ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PARTY_CATEGORY_STYLES[p.category]}`}>
                          {PARTY_CATEGORY_LABELS[p.category]}
                        </span>
                      ) : (
                        <span className="text-zinc-400">Uncategorized</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActiveToggleButton partyId={p.id} active={p.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-medium text-zinc-900">Add party</h2>
          <div className="mt-4">
            <PartyForm />
          </div>
        </div>
      </div>
    </div>
  );
}
