import Link from "next/link";
import { requirePagePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { DEFAULT_INVOICE_WARRANTY, DEFAULT_MEMO_TERMS } from "@/lib/sales/constants";
import { CompanyForm } from "./company-form";

export default async function CompanySettingsPage() {
  await requirePagePermission("admin");
  const s = await prisma.setting.findUnique({ where: { id: "singleton" } });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Company &amp; documents</h1>
        <p className="mt-1 text-sm text-zinc-500">What&apos;s printed on memos and invoices, and their default due dates.</p>
        <Link href="/settings" className="text-sm text-zinc-500 hover:underline">
          &larr; Settings
        </Link>
      </div>
      <CompanyForm
        defaults={{
          companyName: s?.companyName ?? "Opulent Diam",
          companyAddress: s?.companyAddress ?? "",
          companyPhone: s?.companyPhone ?? "",
          companyEmail: s?.companyEmail ?? "",
          companyTaxInfo: s?.companyTaxInfo ?? "",
          bankDetails: s?.bankDetails ?? "",
          memoTerms: s?.memoTerms ?? "",
          invoiceTerms: s?.invoiceTerms ?? "",
          invoiceWarranty: s?.invoiceWarranty ?? "",
          memoDueDays: s?.memoDueDays ?? 14,
          invoiceDueDays: s?.invoiceDueDays ?? 30,
        }}
        placeholders={{ memoTerms: DEFAULT_MEMO_TERMS, invoiceWarranty: DEFAULT_INVOICE_WARRANTY }}
      />
    </div>
  );
}
