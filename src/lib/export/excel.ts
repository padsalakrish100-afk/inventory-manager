import ExcelJS from "exceljs";

export type ExportColumn = { header: string; key: string; width?: number; numFmt?: string };

export async function buildExcelBuffer(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, string | number | null>[],
  options: { totals?: Record<string, string | number | null>; notes?: string[] } = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Inventory Manager";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18, style: c.numFmt ? { numFmt: c.numFmt } : undefined }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
  for (const row of rows) sheet.addRow(row);
  if (options.totals) sheet.addRow(options.totals).font = { bold: true };
  if (options.notes?.length) {
    sheet.addRow({});
    for (const n of options.notes) sheet.addRow([n]).font = { italic: true, color: { argb: "FF71717A" } };
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function excelResponse(filename: string, buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
