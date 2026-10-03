import "server-only";
import { prisma } from "@/lib/prisma";
import { todayIST } from "@/lib/dates";
import { DEFAULT_INVOICE_WARRANTY, DEFAULT_MEMO_TERMS } from "@/lib/sales/constants";

export type DocumentSettings = {
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyTaxInfo: string | null;
  bankDetails: string | null;
  memoTerms: string;
  invoiceTerms: string | null;
  invoiceWarranty: string;
  memoDueDays: number;
  invoiceDueDays: number;
};

// Company details and wording printed on memos and invoices.
export async function documentSettings(): Promise<DocumentSettings> {
  const s = await prisma.setting.findUnique({ where: { id: "singleton" } });
  return {
    companyName: s?.companyName ?? "Opulent Diam",
    companyAddress: s?.companyAddress ?? null,
    companyPhone: s?.companyPhone ?? null,
    companyEmail: s?.companyEmail ?? null,
    companyTaxInfo: s?.companyTaxInfo ?? null,
    bankDetails: s?.bankDetails ?? null,
    memoTerms: s?.memoTerms || DEFAULT_MEMO_TERMS,
    invoiceTerms: s?.invoiceTerms ?? null,
    invoiceWarranty: s?.invoiceWarranty || DEFAULT_INVOICE_WARRANTY,
    memoDueDays: s?.memoDueDays ?? 14,
    invoiceDueDays: s?.invoiceDueDays ?? 30,
  };
}

// Today (India time) plus some days, as YYYY-MM-DD for a date input.
export function todayPlusDays(days: number): string {
  const d = new Date(`${todayIST()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
