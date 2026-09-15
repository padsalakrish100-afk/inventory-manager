import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { STAGE_LABELS } from "@/lib/stages";
import { deleteProcessRate } from "./actions";
import { SettingsForm } from "./settings-form";
import { ProcessRateForm } from "./process-rate-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/transactions");

  const [settings, rates, parties] = await Promise.all([
    getSettings(),
    prisma.processRate.findMany({
      include: { party: true },
      orderBy: [{ stage: "asc" }, { party: { name: "asc" } }],
    }),
    prisma.party.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Change how the app looks and a couple of built-in defaults. No code required.
        </p>
      </div>

      <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-5">
        <SettingsForm key={settings.updatedAtIso} settings={settings} />
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Process rates</h2>
          <p className="mt-1 text-sm text-zinc-500">
            What each party charges per carat for a process — save it here once, then pick it
            from a list instead of retyping it on every lot expense.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Process</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Carat range</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No saved rates yet — add one below.
                  </td>
                </tr>
              )}
              {rates.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-zinc-900">{STAGE_LABELS[r.stage] ?? r.stage}</td>
                  <td className="px-4 py-3 text-zinc-800">{r.party.name}</td>
                  <td className="px-4 py-3 text-zinc-500">₹{r.ratePerCarat.toFixed(2)}/ct</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {r.caratMin !== null || r.caratMax !== null
                      ? `${r.caratMin ?? "0"}–${r.caratMax ?? "∞"}ct`
                      : "Any carat"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteProcessRate.bind(null, r.id)}>
                      <button type="submit" className="text-zinc-400 hover:text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ProcessRateForm partyNames={parties.map((p) => p.name)} />
      </div>
    </div>
  );
}
