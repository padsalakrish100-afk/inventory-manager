import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { can, getViewer, ROLE_LABELS, type Permission } from "@/lib/authz";
import { DesktopNav, MobileNav, type NavItem } from "./app-nav";
import { signOutAction } from "./sign-out-action";

const navItems: { href: string; label: string; permission: Permission; hideFor?: string[] }[] = [
  { href: "/stones", label: "Stones", permission: "stones.view" },
  { href: "/rough", label: "Rough", permission: "lots.manage" },
  { href: "/lotting", label: "Lotting", permission: "lots.manage" },
  { href: "/manufacturing", label: "Manufacturing", permission: "mfg.view" },
  { href: "/karigars", label: "Karigars", permission: "karigars.manage" },
  { href: "/polish", label: "Polish", permission: "stock.view" },
  { href: "/sales/memos", label: "Sales", permission: "memo.manage" },
  { href: "/finance/receivables", label: "Finance", permission: "sales.manage" },
  { href: "/costing", label: "Costing", permission: "costs.view" },
  { href: "/reports", label: "Reports", permission: "stones.view", hideFor: ["OPERATOR"] },
  { href: "/settings", label: "Settings", permission: "admin" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login");
  }

  const { companyName, appName } = await getSettings();
  const brand = companyName || appName;
  const visibleItems: NavItem[] = navItems
    .filter((item) => can(viewer, item.permission) && !item.hideFor?.includes(viewer.role))
    .map(({ href, label }) => ({ href, label }));
  const operator = viewer.role === "OPERATOR";
  const desktopItems: NavItem[] = [...(operator ? [] : [{ href: "/", label: "Dashboard" }]), { href: "/scan", label: "Scan" }, ...visibleItems];
  // On a laptop the less-used sections go under "More".
  const moreHrefs = new Set(["/rough", "/lotting", "/karigars", "/costing", "/settings"]);
  const barItems = desktopItems.filter((i) => !moreHrefs.has(i.href));
  const moreItems = desktopItems.filter((i) => moreHrefs.has(i.href));
  // Phone tabs: the screens each role opens most.
  const tabs: NavItem[] = operator
    ? [
        { href: "/scan", label: "Scan" },
        { href: "/manufacturing/issue", label: "Issue" },
        { href: "/manufacturing/return", label: "Return" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/scan", label: "Scan" },
        can(viewer, "stock.view") ? { href: "/polish", label: "Stock" } : { href: "/stones", label: "Stones" },
      ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-[var(--graphite)] text-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
          <Link href={operator ? "/scan" : "/"} className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
              <Image src="/brand/logo.png" alt="" width={34} height={34} priority className="h-[34px] w-[34px]" />
            </span>
            <span className="font-serif text-lg uppercase tracking-[0.22em] text-white">{brand}</span>
          </Link>

          <DesktopNav items={barItems} more={moreItems} />

          <div className="ml-auto hidden shrink-0 items-center gap-3 text-sm lg:flex">
            <Link href="/account" className="hidden whitespace-nowrap text-[var(--silver)] hover:text-white xl:block">
              {viewer.name} <span className="hidden text-zinc-500 xl:inline">· {ROLE_LABELS[viewer.role]}</span>
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-md border border-white/20 px-3 py-1.5 text-[var(--silver)] hover:border-white/40 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
          <Link href="/account" className="ml-auto hidden max-w-[8rem] truncate text-sm text-[var(--silver)] sm:block lg:hidden">
            {viewer.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:pt-8 lg:pb-10">{children}</main>

      <MobileNav tabs={tabs} items={desktopItems} userLabel={`${viewer.name} · ${ROLE_LABELS[viewer.role]}`} />
    </div>
  );
}
