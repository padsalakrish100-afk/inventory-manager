"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "./sign-out-action";

export type NavItem = { href: string; label: string };

// "/sales/memos" also lights up for /sales/invoices etc. via its section.
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  const section = href.split("/")[1];
  return pathname === href || pathname.startsWith(`/${section}/`) || pathname === `/${section}`;
}

// Desktop: the everyday sections across the graphite bar; the rest sit
// under "More" so the bar never overflows.
export function DesktopNav({ items, more }: { items: NavItem[]; more: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = more.some((m) => isActive(pathname, m.href));
  const linkClass = (active: boolean) =>
    `relative flex min-h-10 items-center whitespace-nowrap rounded-md px-2.5 transition-colors xl:px-3 ${
      active ? "text-white" : "text-[var(--silver)] hover:bg-white/10 hover:text-white"
    }`;
  const underline = <span className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-[#d9dadd]" />;

  return (
    <nav className="hidden min-w-0 flex-1 items-center gap-0.5 text-sm lg:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
            {item.label}
            {active && underline}
          </Link>
        );
      })}
      {more.length > 0 && (
        <div className="relative" onMouseLeave={() => setOpen(false)}>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={linkClass(moreActive)}>
            More <span aria-hidden="true" className="ml-1 text-[10px]">▾</span>
            {moreActive && underline}
          </button>
          {open && (
            <div className="absolute left-0 top-full z-40 pt-2">
              <ul className="min-w-44 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-800 shadow-lg">
                {more.map((m) => (
                  <li key={m.href}>
                    <Link
                      href={m.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-md px-3 py-2 ${isActive(pathname, m.href) ? "bg-zinc-100 font-medium text-zinc-900" : "hover:bg-zinc-50"}`}
                    >
                      {m.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

// Phone: a bottom tab bar for the everyday screens, plus a menu sheet with
// every section, the account page and sign out.
export function MobileNav({ tabs, items, userLabel }: { tabs: NavItem[]; items: NavItem[]; userLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden print:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-24 pt-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300" />
            <p className="px-2 pb-2 text-xs uppercase tracking-wider text-zinc-500">{userLabel}</p>
            <ul className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-12 items-center rounded-lg border px-3 text-sm ${
                      isActive(pathname, item.href) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/account" onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800">
                  Account
                </Link>
              </li>
              <li>
                <form action={signOutAction}>
                  <button type="submit" className="flex min-h-12 w-full items-center rounded-lg border border-zinc-200 px-3 text-left text-sm text-zinc-800">
                    Sign out
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${active ? "font-medium text-zinc-900" : "text-zinc-500"}`}
            >
              <span className={`h-1 w-6 rounded-full ${active ? "bg-zinc-900" : "bg-transparent"}`} />
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${open ? "font-medium text-zinc-900" : "text-zinc-500"}`}
        >
          <span className={`h-1 w-6 rounded-full ${open ? "bg-zinc-900" : "bg-transparent"}`} />
          Menu
        </button>
      </nav>
    </>
  );
}
