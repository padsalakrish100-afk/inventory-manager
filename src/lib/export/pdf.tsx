import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type PdfColumn = { header: string; key: string; flex?: number };

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 2, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: "#71717a", marginBottom: 4 },
  generated: { fontSize: 8, color: "#a1a1aa", marginBottom: 14 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    paddingBottom: 5,
    marginBottom: 3,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e4e4e7",
    paddingVertical: 5,
  },
  cell: { flex: 1, paddingRight: 8 },
  headerCell: { flex: 1, paddingRight: 8, fontFamily: "Helvetica-Bold" },
});

function TableDocument({
  title,
  subtitle,
  columns,
  rows,
}: {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Record<string, string | number>[];
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <Text style={styles.generated}>Generated {new Date().toLocaleString()}</Text>
        <View style={styles.headerRow}>
          {columns.map((c) => (
            <Text key={c.key} style={[styles.headerCell, { flex: c.flex ?? 1 }]}>
              {c.header}
            </Text>
          ))}
        </View>
        {rows.map((row, i) => (
          <View key={i} style={styles.row} wrap={false}>
            {columns.map((c) => (
              <Text key={c.key} style={[styles.cell, { flex: c.flex ?? 1 }]}>
                {String(row[c.key] ?? "")}
              </Text>
            ))}
          </View>
        ))}
        {rows.length === 0 && <Text style={{ color: "#71717a", marginTop: 8 }}>No rows.</Text>}
      </Page>
    </Document>
  );
}

export async function buildPdfBuffer(
  title: string,
  columns: PdfColumn[],
  rows: Record<string, string | number>[],
  subtitle?: string,
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <TableDocument title={title} subtitle={subtitle} columns={columns} rows={rows} />,
  );
  return Buffer.from(buffer);
}

export function pdfResponse(filename: string, buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
