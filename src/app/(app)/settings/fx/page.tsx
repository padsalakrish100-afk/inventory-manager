import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { FillMissingButton, FxForm } from "./fx-form";

export default async function ExchangeRatesPage() {
  await requirePagePermission("admin");
  const rates = await prisma.exchangeRate.findMany({ orderBy: { date: "desc" }, take: 60 });

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Exchange rates</h1>
        <p className="mt-1 text-sm text-zinc-500">
          INR per 1 USD. Every money entry (labour, bills, purchases, sales) stores the rate in force on its date, so
          later changes never rewrite past figures. Enter today&apos;s rate whenever it moves.
        </p>
        <Link href="/settings" className="mt-1 inline-block text-sm text-zinc-500 hover:underline">
          &larr; Settings
        </Link>
      </div>
      <FxForm />
      <FillMissingButton />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium text-right">₹ per $1</th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-zinc-500">
                  No rates yet — add today&apos;s.
                </td>
              </tr>
            )}
            {rates.map((r) => (
              <tr key={r.date.toISOString()} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2">{r.date.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-2 text-right font-medium">{Number(r.usdInr).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
