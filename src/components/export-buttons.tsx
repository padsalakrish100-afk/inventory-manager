export function ExportButtons({ report, params }: { report: string; params?: URLSearchParams }) {
  const base = `/api/export/${report}`;
  const paramString = params?.toString();
  const query = paramString ? `&${paramString}` : "";

  return (
    <div className="flex items-center gap-2">
      <a
        href={`${base}?format=xlsx${query}`}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        Export Excel
      </a>
      <a
        href={`${base}?format=pdf${query}`}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        Export PDF
      </a>
    </div>
  );
}
