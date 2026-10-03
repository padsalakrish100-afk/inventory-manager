import type { ReportColumn, ReportRow, ReportValue } from "@/lib/reports/types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

// A report cell as display text (page and PDF). Excel gets the raw numbers.
export function formatCell(col: ReportColumn, row: ReportRow, opts: { plainCurrency?: boolean } = {}): string {
  const v: ReportValue = row[col.key];
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") return v;
  switch (col.kind) {
    case "carat":
      return v.toFixed(3);
    case "pct":
      return `${v.toFixed(2)}%`;
    case "int":
      return v.toLocaleString("en-IN");
    case "money": {
      const cur = col.currency ?? (col.currencyKey ? String(row[col.currencyKey] ?? "USD") : "USD");
      if (opts.plainCurrency) {
        // The PDF font has no ₹ sign. A fixed-currency column names it in
        // the header, so only mixed columns repeat it per cell.
        const n = v.toLocaleString(cur === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return col.currency ? n : `${cur} ${n}`;
      }
      return cur === "INR" ? inr.format(v) : usd.format(v);
    }
    default:
      return String(v);
  }
}

export function isNumeric(col: ReportColumn): boolean {
  return col.kind === "int" || col.kind === "carat" || col.kind === "pct" || col.kind === "money";
}

// Excel number format for a column.
export function excelFormat(col: ReportColumn): string | undefined {
  switch (col.kind) {
    case "carat":
      return "0.000";
    case "pct":
      return "0.00";
    case "money":
      return "#,##0.00";
    case "int":
      return "#,##0";
    default:
      return undefined;
  }
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
export const r2 = (n: number) => round(n, 2);
export const r3 = (n: number) => round(n, 3);
