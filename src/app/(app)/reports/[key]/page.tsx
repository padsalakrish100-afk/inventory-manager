import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/authz";
import { canRun, readFilters, REPORTS_BY_KEY, runReport } from "@/lib/reports";
import { filterOptions, FILTER_LABELS } from "@/lib/reports/options";
import { periodOf } from "@/lib/reports/common";
import { ExportButtons } from "@/components/export-buttons";
import { ReportTable } from "../report-table";

const INPUT = "mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { key } = await params;
  const def = REPORTS_BY_KEY.get(key);
  if (!def) notFound();
  if (!canRun(viewer, def)) redirect(homePathFor(viewer));

  const sp = await searchParams;
  const filters = readFilters(def, (k) => sp[k]);
  const [data, options] = await Promise.all([runReport(viewer, def, filters), filterOptions(def)]);
  const period = def.filters.includes("from") ? periodOf(filters, Boolean(def.defaultPeriod)) : null;
  const exportParams = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{data.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{data.subtitle ?? def.description}</p>
          <Link href="/reports" className="text-sm text-zinc-500 hover:underline">
            &larr; Reports
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons report={def.key} params={exportParams} />
          {def.key === "stock-list" && (
            <a
              href={`/api/export/rapnet?${exportParams}`}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              RapNet CSV
            </a>
          )}
        </div>
      </div>

      <form className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        {def.filters.map((k) => {
          if (k === "from" || k === "to") {
            return (
              <label key={k} className="text-xs font-medium text-zinc-500">
                {FILTER_LABELS[k]}
                <input type="date" name={k} defaultValue={filters[k] ?? (k === "from" ? period?.from : period?.to) ?? ""} className={INPUT} />
              </label>
            );
          }
          const choices = options[k] ?? [];
          const hasBlank = choices.some((c) => c.value === "");
          return (
            <label key={k} className="text-xs font-medium text-zinc-500">
              {FILTER_LABELS[k]}
              <select name={k} defaultValue={filters[k] ?? ""} className={INPUT}>
                {!hasBlank && <option value="">All</option>}
                {choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <div className="col-span-2 flex items-end gap-3 sm:col-span-3 lg:col-span-6">
          <button type="submit" className="min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white hover:brightness-110">
            Run report
          </button>
          <Link href={`/reports/${def.key}`} className="text-sm text-zinc-500 hover:underline">
            Reset
          </Link>
        </div>
      </form>

      <ReportTable data={data} />
    </div>
  );
}
