import "server-only";

// Optional GIA Report Check API (needs an API key from GIA). With
// GIA_REPORT_API_KEY unset the feature is hidden everywhere.
const ENDPOINT = process.env.GIA_REPORT_API_URL ?? "https://api.reportresults.gia.edu/";

export function giaCheckEnabled(): boolean {
  return Boolean(process.env.GIA_REPORT_API_KEY);
}

export type GiaReport = {
  reportNumber: string;
  reportDate: string | null;
  shape: string | null;
  carat: string | null;
  color: string | null;
  clarity: string | null;
  cut: string | null;
  polish: string | null;
  symmetry: string | null;
  fluorescence: string | null;
  measurements: string | null;
};

const QUERY = `query ReportQuery($ReportNumber: String!) {
  getReport(report_number: $ReportNumber) {
    report_number
    report_date
    results {
      __typename
      ... on DiamondGradingReportResults {
        shape_and_cutting_style
        carat_weight
        color_grade
        clarity_grade
        cut_grade
        polish
        symmetry
        fluorescence
        measurements
      }
    }
  }
}`;

// Looks a report up on GIA. Returns null when GIA has no such report.
export async function giaReportCheck(reportNumber: string): Promise<GiaReport | null> {
  const key = process.env.GIA_REPORT_API_KEY;
  if (!key) throw new Error("GIA Report Check isn't configured.");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query: QUERY, variables: { ReportNumber: reportNumber.trim() } }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GIA responded ${res.status}.`);
  const json = (await res.json()) as {
    data?: { getReport?: { report_number: string; report_date?: string; results?: Record<string, string | null> } | null };
    errors?: { message: string }[];
  };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const r = json.data?.getReport;
  if (!r) return null;
  const x = r.results ?? {};
  return {
    reportNumber: r.report_number,
    reportDate: r.report_date ?? null,
    shape: x.shape_and_cutting_style ?? null,
    carat: x.carat_weight ?? null,
    color: x.color_grade ?? null,
    clarity: x.clarity_grade ?? null,
    cut: x.cut_grade ?? null,
    polish: x.polish ?? null,
    symmetry: x.symmetry ?? null,
    fluorescence: x.fluorescence ?? null,
    measurements: x.measurements ?? null,
  };
}
