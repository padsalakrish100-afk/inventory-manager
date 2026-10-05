"use client";

import Image from "next/image";
import { useActionState } from "react";
import { loginAction } from "./actions";

const INPUT =
  "mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 sm:text-sm";

export function LoginForm({ brand }: { brand: string }) {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/brand/logo.png" alt={`${brand} logo`} width={112} height={112} priority className="h-28 w-28" />
          <p className="mt-4 font-serif text-3xl uppercase tracking-[0.25em] text-zinc-900">{brand}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-zinc-500">Diamond manufacturing</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
          <h1 className="font-serif text-2xl font-semibold text-zinc-900">Sign in</h1>
          <form action={formAction} className="mt-5 flex flex-col gap-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-zinc-700">
                Username
              </label>
              <input id="username" name="username" type="text" required autoComplete="username" className={INPUT} />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Password
              </label>
              <input id="password" name="password" type="password" required autoComplete="current-password" className={INPUT} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 min-h-12 w-full rounded-md bg-[var(--graphite)] px-4 text-base font-medium tracking-wide text-white hover:bg-black disabled:opacity-60"
            >
              {pending ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-400">© {new Date().getFullYear()} {brand}</p>
      </div>
    </div>
  );
}
