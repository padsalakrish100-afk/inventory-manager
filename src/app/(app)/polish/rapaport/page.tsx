import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, requirePagePermission } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { RapUploadForm } from "./upload-form";

export default async function RapaportPage() {
  const viewer = await requirePagePermission("stock.view");
  const lists = await prisma.rapaportList.findMany({ orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }], take: 20 });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Rapaport price lists</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload the price list as a CSV (from your own Rapaport/RapNet subscription — nothing is fetched automatically).
          Columns: Shape, Clarity, Color, Low Size, High Size, Price (in hundreds of $/ct). Rounds use the round table;
          every other shape — including Old Mine cushions — uses the pear table, as Rapaport does. Old European cuts use
          round.
        </p>
        <Link href="/polish" className="text-sm text-zinc-500 hover:underline">
          &larr; Polish
        </Link>
      </div>
      {can(viewer, "stock.edit") && <RapUploadForm />}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Effective</th>
              <th className="px-4 py-2 font-medium">File</th>
              <th className="px-4 py-2 font-medium text-right">Prices</th>
              <th className="px-4 py-2 font-medium">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {lists.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No list uploaded yet — “vs Rap” figures appear once one is.
                </td>
              </tr>
            )}
            {lists.map((l, i) => (
              <tr key={l.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2">
                  {l.effectiveDate.toISOString().slice(0, 10)}
                  {i === 0 && <span className="ml-2 text-xs text-emerald-700">in use</span>}
                </td>
                <td className="px-4 py-2 text-zinc-600">{l.fileName ?? "—"}</td>
                <td className="px-4 py-2 text-right">{l.rowCount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2 text-zinc-600">{formatDate(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
