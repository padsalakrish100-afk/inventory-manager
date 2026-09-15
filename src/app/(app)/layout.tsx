import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getSettings } from "@/lib/settings";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/lots", label: "Lots" },
  { href: "/transactions", label: "Transactions" },
  { href: "/parties", label: "Contacts" },
  { href: "/reports", label: "Reports" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "ADMIN";
  const { appName } = await getSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-[var(--accent)]">{appName}</span>
            <nav className="flex gap-4 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-zinc-600 hover:text-zinc-900"
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link href="/users" className="text-zinc-600 hover:text-zinc-900">
                  Users
                </Link>
              )}
              {isAdmin && (
                <Link href="/settings" className="text-zinc-600 hover:text-zinc-900">
                  Settings
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span>
              {session.user.name} ({session.user.role})
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
