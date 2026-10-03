import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { getSettings } from "@/lib/settings";
import { can, getViewer, ROLE_LABELS, type Permission } from "@/lib/authz";

const navItems: { href: string; label: string; permission: Permission }[] = [
  { href: "/stones", label: "Stones", permission: "stones.view" },
  { href: "/rough", label: "Rough", permission: "lots.manage" },
  { href: "/lotting", label: "Lotting", permission: "lots.manage" },
  { href: "/manufacturing", label: "Manufacturing", permission: "mfg.view" },
  { href: "/karigars", label: "Karigars", permission: "karigars.manage" },
  { href: "/polish", label: "Polish", permission: "stock.view" },
  { href: "/sales/memos", label: "Sales", permission: "memo.manage" },
  { href: "/finance/receivables", label: "Finance", permission: "sales.manage" },
  { href: "/costing", label: "Costing", permission: "costs.view" },
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

  const { appName } = await getSettings();
  const visibleItems = navItems.filter((item) => can(viewer, item.permission));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="shrink-0 whitespace-nowrap font-semibold text-[var(--accent)]">
              {appName}
            </Link>
            <div className="flex items-center gap-2 text-sm text-zinc-600 sm:hidden">
              <Link href="/account" className="max-w-[9rem] truncate hover:underline">
                {viewer.name}
              </Link>
            </div>
          </div>

          {/* Scrolls sideways on a phone instead of wrapping. */}
          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm [scrollbar-width:none] sm:mx-0 sm:flex-1 sm:px-0 sm:pl-4 [&::-webkit-scrollbar]:hidden">
            <Link
              href="/scan"
              className="flex min-h-10 items-center whitespace-nowrap rounded-md bg-[var(--accent)] px-3 font-medium text-white hover:brightness-110"
            >
              Scan
            </Link>
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-10 items-center whitespace-nowrap rounded-md px-3 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-3 text-sm text-zinc-600 sm:flex">
            <Link href="/account" className="whitespace-nowrap hover:text-zinc-900 hover:underline">
              {viewer.name} ({ROLE_LABELS[viewer.role]})
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="whitespace-nowrap rounded-md border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
