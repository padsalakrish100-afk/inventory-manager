import Link from "next/link";
import { redirect } from "next/navigation";
import { can, getViewer } from "@/lib/authz";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { formatUsd } from "@/lib/money";
import { STONE_STATUS_LABELS } from "@/lib/stone/status";
import { excessAlerts, monthSales, overdueMemos, pendingSummary, receivablesSummary, stageCounts, stockValue } from "@/lib/dashboard";

// The home dashboard: each card shows only what the viewer may see.
// Operators work from the scanner instead.
export default async function Dashboard() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "OPERATOR") redirect("/scan");

  const mfg = can(viewer, "mfg.view");
  const costs = can(viewer, "costs.view");
  // One card at a time (each runs a few queries in parallel) so a page load
  // never opens more database connections than the pool holds.
  const stages = mfg ? await stageCounts() : null;
  const pending = mfg ? await pendingSummary() : null;
  const alerts = mfg ? await excessAlerts() : null;
  const memos = can(viewer, "memo.manage") ? await overdueMemos() : null;
  const stock = can(viewer, "stock.view") ? await stockValue() : null;
  const sales = can(viewer, "sales.reports") && can(viewer, "sales.manage") ? await monthSales(costs) : null;
  const receivables = can(viewer, "sales.manage") ? await receivablesSummary() : null;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const month = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{today}</p>
        <h1 className="mt-1 text-zinc-900">
          {greeting}, {viewer.name.split(" ")[0]}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sales && (
          <Card title={`Sales — ${month}`} href="/reports/sales">
            <Big>{formatUsd(sales.salesUsd)}</Big>
            <p className="text-sm text-zinc-500">
              {sales.stones} {sales.stones === 1 ? "stone" : "stones"} · {sales.carats.toFixed(3)} ct
            </p>
            {sales.profitUsd !== null && (
              <p className={`mt-2 text-sm font-medium ${sales.profitUsd < 0 ? "text-red-700" : "text-emerald-700"}`}>
                Profit {formatUsd(sales.profitUsd)}
                {sales.margin !== null ? ` · ${sales.margin.toFixed(1)}% margin` : ""}
                <Link href="/reports/profit" className="ml-2 text-xs font-normal text-zinc-500 underline">
                  details
                </Link>
              </p>
            )}
          </Card>
        )}

        {receivables && (
          <Card title="Receivables" href="/finance/receivables">
            {receivables.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing outstanding.</p>
            ) : (
              receivables.map((r) => (
                <div key={r.currency} className="mb-2 last:mb-0">
                  <Big>{formatMoney(r.outstanding, r.currency)}</Big>
                  <p className="text-sm text-zinc-500">
                    {r.invoices} open {r.invoices === 1 ? "invoice" : "invoices"}
                    {r.overdue > 0 && <span className="text-red-700"> · {formatMoney(r.overdue, r.currency)} overdue</span>}
                    {r.over90 > 0 && <span className="text-red-700"> · {formatMoney(r.over90, r.currency)} over 90 days</span>}
                  </p>
                </div>
              ))
            )}
          </Card>
        )}

        {stock && (
          <Card title="Stock value" href={costs ? "/costing" : "/reports/stock-list"}>
            <p className="text-sm text-zinc-500">
              Polished: {stock.polished.stones} stones · {stock.polished.carats.toFixed(3)} ct
            </p>
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
              <div>
                <p className="text-xs text-zinc-500">At asking</p>
                <Big>{formatUsd(stock.polished.askingUsd)}</Big>
              </div>
              {costs && (
                <div>
                  <p className="text-xs text-zinc-500">At cost</p>
                  <Big>{formatUsd(stock.polished.costUsd)}</Big>
                </div>
              )}
            </div>
            {stock.polished.unpriced > 0 && <p className="mt-1 text-xs text-amber-700">{stock.polished.unpriced} without an asking price</p>}
            {costs && stock.wip.stones > 0 && (
              <p className="mt-2 text-sm text-zinc-500">
                In production: {stock.wip.stones} stones at cost {formatUsd(stock.wip.costUsd)}
              </p>
            )}
          </Card>
        )}

        {memos && (
          <Card title="Memos" href={memos.count ? "/sales/memos?show=overdue" : "/sales/memos"}>
            <Big className={memos.count ? "text-red-700" : ""}>{memos.count} overdue</Big>
            <p className="text-sm text-zinc-500">
              {memos.stonesOut} {memos.stonesOut === 1 ? "stone" : "stones"} out on memo
            </p>
            {memos.list.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {memos.list.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <Link href={`/sales/memos/${m.id}`} className="truncate hover:underline">
                      <span className="font-mono text-xs">{m.memoNo}</span> {m.party}
                    </Link>
                    <span className="shrink-0 text-red-700">{m.days}d late</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {pending && (
          <Card title="Pending with karigars" href="/manufacturing/pending">
            <Big>{pending.total} out</Big>
            <p className={`text-sm ${pending.overdue ? "text-red-700" : "text-zinc-500"}`}>
              {pending.overdue} out longer than {pending.alertDays} days
            </p>
            {pending.top.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {pending.top.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <Link href={`/manufacturing/pending?party=${p.id}`} className="truncate hover:underline">
                      {p.name}
                    </Link>
                    <span className="shrink-0 text-zinc-500">{p.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {alerts && (
          <Card title="Excess-loss alerts" href="/manufacturing/alerts">
            <Big className={alerts.count ? "text-red-700" : ""}>{alerts.count} to review</Big>
            {alerts.latest.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {alerts.latest.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <Link href={`/stones/${a.product.id}`} className="truncate hover:underline">
                      <span className="font-mono text-xs">{a.product.sku}</span> {a.stage?.name ?? ""} · {a.party?.name ?? ""}
                    </Link>
                    <span className="shrink-0 text-red-700">
                      {a.lossPct ? `${Number(a.lossPct).toFixed(2)}%` : ""}
                      {a.lossLimitPct ? ` / ${Number(a.lossLimitPct).toFixed(2)}%` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {stages && (
          <Card title="Stones by stage" href="/manufacturing" className="md:col-span-2 xl:col-span-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {stages.stages.map((s) => (
                <Link key={s.id} href={`/manufacturing/pending?stage=${s.id}`} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 hover:bg-zinc-100">
                  <p className="truncate text-xs text-zinc-500">{s.name}</p>
                  <p className="font-serif text-2xl font-semibold text-zinc-900">{s.count}</p>
                </Link>
              ))}
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              {(["IN_PRODUCTION", "POLISHED", "AT_LAB", "IN_STOCK", "ON_MEMO", "SOLD"] as const)
                .map((k) => `${STONE_STATUS_LABELS[k]}: ${stages.byStatus[k] ?? 0}`)
                .join(" · ")}
            </p>
          </Card>
        )}
      </div>

      <p className="text-xs text-zinc-400">
        Updated {formatDate(new Date())} ·{" "}
        <Link href="/reports" className="underline">
          All reports
        </Link>
      </p>
    </div>
  );
}

function Card({ title, href, children, className = "" }: { title: string; href: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-xl border border-zinc-200 bg-white p-5 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">{title}</h2>
        <Link href={href} className="text-xs text-zinc-400 hover:text-zinc-700 hover:underline">
          Open &rarr;
        </Link>
      </div>
      {children}
    </section>
  );
}

function Big({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-serif text-[1.9rem] font-semibold leading-tight text-zinc-900 ${className}`}>{children}</p>;
}
