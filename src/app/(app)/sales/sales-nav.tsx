import Link from "next/link";
import { can, type Viewer } from "@/lib/authz";

const LINKS = [
  { href: "/sales/memos", label: "Memos", show: (v: Viewer) => can(v, "memo.manage") },
  { href: "/sales/invoices", label: "Invoices", show: (v: Viewer) => can(v, "sales.manage") },
  { href: "/sales/payments", label: "Payments", show: (v: Viewer) => can(v, "sales.manage") || can(v, "costs.view") },
  { href: "/finance/receivables", label: "Receivables", show: (v: Viewer) => can(v, "sales.manage") },
  { href: "/finance/payables", label: "Payables", show: (v: Viewer) => can(v, "costs.view") },
];

// Links between the sales and finance screens, highlighting the current one.
export function SalesNav({ viewer, current }: { viewer: Viewer; current: string }) {
  const links = LINKS.filter((l) => l.show(viewer));
  if (links.length < 2) return null;
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`min-h-10 shrink-0 rounded-md border px-4 py-2 text-sm ${
            l.href === current ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
