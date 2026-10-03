import Link from "next/link";
import { requirePagePermission } from "@/lib/authz";
import { todayIST } from "@/lib/dates";
import { customerNames, pickableStones } from "@/lib/sales/pickable";
import { documentSettings, todayPlusDays } from "@/lib/sales/company";
import { MemoForm } from "./memo-form";

export default async function NewMemoPage({ searchParams }: { searchParams: Promise<{ stone?: string }> }) {
  await requirePagePermission("memo.manage");
  const sp = await searchParams;
  const [stones, customers, settings] = await Promise.all([pickableStones({ includeOnMemo: false }), customerNames(), documentSettings()]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">New memo</h1>
        <p className="mt-1 text-sm text-zinc-500">Send stones in stock to a customer on consignment.</p>
        <Link href="/sales/memos" className="text-sm text-zinc-500 hover:underline">
          &larr; Memos
        </Link>
      </div>
      <MemoForm
        stones={stones}
        customers={customers}
        initialStones={sp.stone ? [sp.stone] : []}
        defaults={{ date: todayIST(), dueDate: todayPlusDays(settings.memoDueDays), terms: settings.memoTerms }}
      />
    </div>
  );
}
