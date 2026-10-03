import Link from "next/link";
import { formatCell, isNumeric } from "@/lib/reports/format";
import type { ReportResult } from "@/lib/reports/types";

const MAX_ROWS = 1000;

// A report's rows as a table (first 1,000 on screen; exports have all).
export function ReportTable({ data }: { data: ReportResult }) {
  const shown = data.rows.slice(0, MAX_ROWS);
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              {data.columns.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-3 py-2.5 font-medium ${isNumeric(c) ? "text-right" : ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={data.columns.length} className="px-4 py-6 text-center text-zinc-500">
                  Nothing matches these filters.
                </td>
              </tr>
            )}
            {shown.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0">
                {data.columns.map((c) => {
                  const text = formatCell(c, row);
                  const href = c.hrefKey ? row[c.hrefKey] : null;
                  return (
                    <td key={c.key} className={`px-3 py-2 ${isNumeric(c) ? "whitespace-nowrap text-right tabular-nums" : ""} text-zinc-700`}>
                      {href && typeof href === "string" ? (
                        <Link href={href} className="font-medium text-zinc-900 hover:underline">
                          {text}
                        </Link>
                      ) : (
                        text
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {data.totals && shown.length > 0 && (
            <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-medium text-zinc-900">
              <tr>
                {data.columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 ${isNumeric(c) ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                    {formatCell(c, data.totals!)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data.rows.length > MAX_ROWS && (
        <p className="text-sm text-amber-700">
          Showing the first {MAX_ROWS.toLocaleString("en-IN")} of {data.rows.length.toLocaleString("en-IN")} rows — export to Excel for all of them.
        </p>
      )}
      {data.notes?.map((n) => (
        <p key={n} className="text-xs text-zinc-500">
          {n}
        </p>
      ))}
    </div>
  );
}
