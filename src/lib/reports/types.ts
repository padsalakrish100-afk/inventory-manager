// Shared shapes for the report engine: one definition feeds the report page,
// the Excel export and the PDF export.

export type ColumnKind = "text" | "int" | "carat" | "pct" | "money" | "date";

export type ReportColumn = {
  key: string;
  header: string;
  kind?: ColumnKind;
  // Money columns: a fixed currency, or the row field holding it.
  currency?: "USD" | "INR";
  currencyKey?: string;
  width?: number;
  // Cost/profit columns — dropped for anyone without cost visibility.
  costOnly?: boolean;
  // Optional link for text cells: row field holding the href.
  hrefKey?: string;
};

export type ReportValue = string | number | null;
export type ReportRow = Record<string, ReportValue>;

export type ReportResult = {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  totals?: ReportRow;
  notes?: string[];
};

export type FilterKey =
  | "from"
  | "to"
  | "party"
  | "karigar"
  | "stage"
  | "lot"
  | "shape"
  | "cutStyle"
  | "status"
  | "location"
  | "lineStatus"
  | "kind"
  | "currency"
  | "flag"
  | "groupBy";

export type Filters = Partial<Record<FilterKey, string>>;

export type FilterChoice = { value: string; label: string };
