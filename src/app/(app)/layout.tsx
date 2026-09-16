import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getSettings } from "@/lib/settings";

const navItems = [
  { href: "/lotting", label: "Lotting" },
  { href: "/manufacturing", label: "Manufacturing" },
  { href: "/polish", label: "Polish" },
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-6">
            <span className="shrink-0 whitespace-nowrap font-semibold text-[var(--accent)]">{appName}</span>
            <nav className="flex flex-wrap gap-4 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap text-zinc-600 hover:text-zinc-900"
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link href="/users" className="whitespace-nowrap text-zinc-600 hover:text-zinc-900">
                  Users
                </Link>
              )}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3 text-sm text-zinc-600">
            <Link href="/account" className="whitespace-nowrap hover:text-zinc-900 hover:underline">
              {session.user.name} ({session.user.role})
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
