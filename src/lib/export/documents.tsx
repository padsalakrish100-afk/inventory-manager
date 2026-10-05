import { Document, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { brandLogo } from "@/lib/export/brand";
import type { DocumentSettings } from "@/lib/sales/company";

// Printable sales memo and invoice (A4 portrait).

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#18181b" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  company: { fontSize: 15, fontFamily: "Times-Bold", letterSpacing: 2.5, textTransform: "uppercase" },
  small: { fontSize: 8, color: "#52525b", lineHeight: 1.4 },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  docMeta: { fontSize: 9, textAlign: "right", lineHeight: 1.5 },
  boxes: { flexDirection: "row", gap: 12, marginBottom: 14 },
  box: { flex: 1, borderWidth: 0.5, borderColor: "#d4d4d8", padding: 8 },
  panel: { borderWidth: 0.5, borderColor: "#d4d4d8", padding: 8 },
  boxLabel: { fontSize: 7, color: "#71717a", marginBottom: 3, textTransform: "uppercase" },
  bold: { fontFamily: "Helvetica-Bold" },
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#18181b", paddingBottom: 4, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e4e4e7", paddingVertical: 4 },
  totals: { marginTop: 8, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#18181b", fontFamily: "Helvetica-Bold", fontSize: 10 },
  para: { fontSize: 8, color: "#3f3f46", lineHeight: 1.45, marginTop: 10 },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  sign: { width: 200, borderTopWidth: 0.5, borderTopColor: "#71717a", paddingTop: 4, fontSize: 8, color: "#52525b" },
});

const COLS = [
  { key: "no", label: "#", flex: 0.4 },
  { key: "stockId", label: "Stock ID", flex: 1.1 },
  { key: "description", label: "Description", flex: 3.4 },
  { key: "carats", label: "Carats", flex: 0.9, right: true },
  { key: "perCt", label: "Price / ct", flex: 1.3, right: true },
  { key: "amount", label: "Amount", flex: 1.4, right: true },
] as const;

export type DocLine = { stockId: string; description: string; carats: string; perCt: string; amount: string };

function Company({ c }: { c: DocumentSettings }) {
  const logo = brandLogo();
  return (
    <View style={{ maxWidth: 320, flexDirection: "row", gap: 10 }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image (PDF), not an HTML img */}
      {logo && <Image src={{ data: logo, format: "png" }} style={{ width: 46, height: 46 }} />}
      <View>
      <Text style={s.company}>{c.companyName}</Text>
      {c.companyAddress && <Text style={s.small}>{c.companyAddress}</Text>}
      {(c.companyPhone || c.companyEmail) && <Text style={s.small}>{[c.companyPhone, c.companyEmail].filter(Boolean).join(" · ")}</Text>}
      {c.companyTaxInfo && <Text style={s.small}>{c.companyTaxInfo}</Text>}
      </View>
    </View>
  );
}

function Lines({ lines, totalCarats }: { lines: DocLine[]; totalCarats: string }) {
  return (
    <View>
      <View style={s.thead}>
        {COLS.map((c) => (
          <Text key={c.key} style={{ flex: c.flex, textAlign: "right" in c ? "right" : "left", paddingRight: 4 }}>
            {c.label}
          </Text>
        ))}
      </View>
      {lines.map((l, i) => {
        const v: Record<string, string> = { no: String(i + 1), ...l };
        return (
          <View key={i} style={s.row} wrap={false}>
            {COLS.map((c) => (
              <Text key={c.key} style={{ flex: c.flex, textAlign: "right" in c ? "right" : "left", paddingRight: 4 }}>
                {v[c.key]}
              </Text>
            ))}
          </View>
        );
      })}
      <View style={[s.row, s.bold]}>
        <Text style={{ flex: 4.9 }}>
          {lines.length} {lines.length === 1 ? "stone" : "stones"}
        </Text>
        <Text style={{ flex: 0.9, textAlign: "right", paddingRight: 4 }}>{totalCarats}</Text>
        <Text style={{ flex: 2.7 }} />
      </View>
    </View>
  );
}

function PartyBox({ label, name, lines }: { label: string; name: string; lines: (string | null | undefined)[] }) {
  return (
    <View style={s.box}>
      <Text style={s.boxLabel}>{label}</Text>
      <Text style={s.bold}>{name}</Text>
      {lines.filter(Boolean).map((l, i) => (
        <Text key={i} style={s.small}>
          {l}
        </Text>
      ))}
    </View>
  );
}

export type MemoDoc = {
  memoNo: string;
  date: string;
  dueDate: string;
  currency: string;
  party: { name: string; lines: (string | null)[] };
  lines: DocLine[];
  totalCarats: string;
  total: string;
  terms: string | null;
};

function MemoDocument({ c, m }: { c: DocumentSettings; m: MemoDoc }) {
  return (
    <Document title={`Memo ${m.memoNo}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Company c={c} />
          <View>
            <Text style={s.docTitle}>MEMORANDUM</Text>
            <Text style={s.docMeta}>No. {m.memoNo}</Text>
            <Text style={s.docMeta}>Date {m.date}</Text>
            <Text style={[s.docMeta, s.bold]}>Return by {m.dueDate}</Text>
          </View>
        </View>
        <View style={s.boxes}>
          <PartyBox label="Consignee" name={m.party.name} lines={m.party.lines} />
          <View style={s.box}>
            <Text style={s.boxLabel}>Currency</Text>
            <Text>{m.currency}</Text>
          </View>
        </View>
        <Lines lines={m.lines} totalCarats={m.totalCarats} />
        <View style={s.totals}>
          <View style={s.grand}>
            <Text>Memo value</Text>
            <Text>{m.total}</Text>
          </View>
        </View>
        <Text style={s.para}>{m.terms ?? c.memoTerms}</Text>
        <View style={s.signatures}>
          <Text style={s.sign}>For {c.companyName}</Text>
          <Text style={s.sign}>Received in good order by (name, signature, date)</Text>
        </View>
      </Page>
    </Document>
  );
}

export type InvoiceDoc = {
  invoiceNo: string;
  date: string;
  dueDate: string | null;
  currency: string;
  fxRate: string | null;
  party: { name: string; lines: (string | null)[] };
  shipTo: { name: string; lines: (string | null)[] } | null;
  lines: DocLine[];
  totalCarats: string;
  subtotal: string;
  shipping: string | null;
  insurance: string | null;
  total: string;
  exportRows: [string, string][];
  notes: string | null;
  voided: boolean;
};

function InvoiceDocument({ c, inv }: { c: DocumentSettings; inv: InvoiceDoc }) {
  return (
    <Document title={`Invoice ${inv.invoiceNo}`}>
      <Page size="A4" style={s.page}>
        {inv.voided && <Text style={{ color: "#b91c1c", fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 6 }}>VOID</Text>}
        <View style={s.header}>
          <Company c={c} />
          <View>
            <Text style={s.docTitle}>INVOICE</Text>
            <Text style={s.docMeta}>No. {inv.invoiceNo}</Text>
            <Text style={s.docMeta}>Date {inv.date}</Text>
            {inv.dueDate && <Text style={s.docMeta}>Payment due {inv.dueDate}</Text>}
          </View>
        </View>
        <View style={s.boxes}>
          <PartyBox label="Bill to" name={inv.party.name} lines={inv.party.lines} />
          {inv.shipTo && <PartyBox label="Ship to" name={inv.shipTo.name} lines={inv.shipTo.lines} />}
        </View>
        <Lines lines={inv.lines} totalCarats={inv.totalCarats} />
        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text>Subtotal</Text>
            <Text>{inv.subtotal}</Text>
          </View>
          {inv.shipping && (
            <View style={s.totalRow}>
              <Text>Shipping</Text>
              <Text>{inv.shipping}</Text>
            </View>
          )}
          {inv.insurance && (
            <View style={s.totalRow}>
              <Text>Insurance</Text>
              <Text>{inv.insurance}</Text>
            </View>
          )}
          <View style={s.grand}>
            <Text>Total {inv.currency}</Text>
            <Text>{inv.total}</Text>
          </View>
        </View>
        {inv.exportRows.length > 0 && (
          <View style={[s.panel, { marginTop: 12 }]} wrap={false}>
            <Text style={s.boxLabel}>Shipment</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {inv.exportRows.map(([k, v]) => (
                <Text key={k} style={{ width: "50%", fontSize: 8, paddingVertical: 1 }}>
                  <Text style={s.bold}>{k}: </Text>
                  {v}
                </Text>
              ))}
            </View>
          </View>
        )}
        {inv.notes && <Text style={s.para}>{inv.notes}</Text>}
        {c.bankDetails && (
          <View style={[s.panel, { marginTop: 10 }]} wrap={false}>
            <Text style={s.boxLabel}>Payment details</Text>
            <Text style={s.small}>{c.bankDetails}</Text>
          </View>
        )}
        {c.invoiceTerms && <Text style={s.para}>{c.invoiceTerms}</Text>}
        <Text style={s.para}>{c.invoiceWarranty}</Text>
        <View style={s.signatures}>
          <Text style={s.sign}>For {c.companyName}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function memoPdf(c: DocumentSettings, m: MemoDoc): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(<MemoDocument c={c} m={m} />));
}

export async function invoicePdf(c: DocumentSettings, inv: InvoiceDoc): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(<InvoiceDocument c={c} inv={inv} />));
}
