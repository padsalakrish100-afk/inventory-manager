import { can, getViewer } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/dates";
import { documentSettings } from "@/lib/sales/company";
import { describeStone } from "@/lib/sales/stones";
import { invoicePdf, memoPdf, type DocLine } from "@/lib/export/documents";

// Amounts as plain numbers (the PDF's built-in font has no ₹ sign); the
// currency is printed in the column/total headings.
function amount(value: { toString(): string } | number, currency: string): string {
  return Number(value.toString()).toLocaleString(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function partyLines(p: { companyName: string | null; contactPerson: string | null; address: string | null; country: string | null; email: string | null; phone: string | null; taxIds: unknown }): (string | null)[] {
  const tax = p.taxIds && typeof p.taxIds === "object" && !Array.isArray(p.taxIds)
    ? Object.entries(p.taxIds as Record<string, unknown>).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()}: ${String(v)}`).join(" · ")
    : null;
  return [p.companyName, p.contactPerson ? `Attn: ${p.contactPerson}` : null, p.address, p.country, [p.phone, p.email].filter(Boolean).join(" · ") || null, tax || null];
}

function pdf(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Not signed in", { status: 401 });
  const { kind, id } = await params;
  const company = await documentSettings();

  if (kind === "memo") {
    if (!can(viewer, "memo.manage")) return new Response("Forbidden", { status: 403 });
    const memo = await prisma.salesMemo.findUnique({
      where: { id },
      include: { party: true, lines: { include: { stone: { include: { polishedStone: true } } }, orderBy: { id: "asc" } } },
    });
    if (!memo || memo.voidedAt) return new Response("Not found", { status: 404 });
    // A memo prints the stones still out (returned/sold ones are settled).
    const out = memo.lines.filter((l) => l.status === "OUT");
    const printed = out.length > 0 ? out : memo.lines;
    const lines: DocLine[] = printed.map((l) => ({
      stockId: l.stone.polishedStone?.stockId ?? l.stone.sku,
      description: l.stone.polishedStone ? describeStone(l.stone.polishedStone) : l.stone.name,
      carats: Number(l.carats).toFixed(3),
      perCt: amount(l.pricePerCt, memo.currency),
      amount: amount(l.amount, memo.currency),
    }));
    const buffer = await memoPdf(company, {
      memoNo: memo.memoNo,
      date: formatDate(memo.date),
      dueDate: formatDate(memo.dueDate),
      currency: memo.currency,
      party: { name: memo.party.name, lines: partyLines(memo.party) },
      lines,
      totalCarats: printed.reduce((a, l) => a + Number(l.carats), 0).toFixed(3),
      total: `${memo.currency} ${amount(printed.reduce((a, l) => a + Number(l.amount), 0), memo.currency)}`,
      terms: memo.terms,
    });
    return pdf(buffer, `${memo.memoNo}.pdf`);
  }

  if (kind === "invoice") {
    if (!can(viewer, "sales.manage")) return new Response("Forbidden", { status: 403 });
    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: { party: true, lines: { include: { stone: { include: { polishedStone: { select: { stockId: true } } } } }, orderBy: { id: "asc" } } },
    });
    if (!inv) return new Response("Not found", { status: 404 });
    const exportRows: [string, string][] = (
      [
        ["Incoterm", inv.incoterm],
        ["HS code", inv.hsCode],
        ["Port of loading", inv.portOfLoading],
        ["Port of discharge", inv.portOfDischarge],
        ["Carrier", inv.carrier],
        ["AWB no.", inv.awbNo],
        ["KP certificate", inv.kpCertNo],
        ["Exchange rate", inv.fxRate ? `INR ${inv.fxRate.toString()} per USD` : null],
      ] as [string, string | null][]
    ).filter((r): r is [string, string] => Boolean(r[1]));
    const buffer = await invoicePdf(company, {
      invoiceNo: inv.invoiceNo,
      date: formatDate(inv.date),
      dueDate: inv.dueDate ? formatDate(inv.dueDate) : null,
      currency: inv.currency,
      fxRate: inv.fxRate?.toString() ?? null,
      party: { name: inv.party.name, lines: partyLines(inv.party) },
      shipTo: inv.shipToName || inv.shipToAddress ? { name: inv.shipToName ?? inv.party.name, lines: [inv.shipToAddress, inv.shipToCountry] } : null,
      lines: inv.lines.map((l) => ({
        stockId: l.stone.polishedStone?.stockId ?? l.stone.sku,
        description: l.description ?? "Polished diamond",
        carats: Number(l.carats).toFixed(3),
        perCt: amount(l.pricePerCt, inv.currency),
        amount: amount(l.amount, inv.currency),
      })),
      totalCarats: inv.lines.reduce((a, l) => a + Number(l.carats), 0).toFixed(3),
      subtotal: amount(inv.subtotal, inv.currency),
      shipping: inv.shipping ? amount(inv.shipping, inv.currency) : null,
      insurance: inv.insurance ? amount(inv.insurance, inv.currency) : null,
      total: amount(inv.total, inv.currency),
      exportRows,
      notes: inv.notes,
      voided: Boolean(inv.voidedAt),
    });
    return pdf(buffer, `${inv.invoiceNo}.pdf`);
  }

  return new Response("Not found", { status: 404 });
}
