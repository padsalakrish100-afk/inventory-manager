"use client";

import { useActionState, useState } from "react";
import { updateSettings } from "./actions";
import type { AppSettings } from "@/lib/settings";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [error, formAction, pending] = useActionState(updateSettings, undefined);
  const [color, setColor] = useState(settings.accentColor);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <label htmlFor="appName" className="block text-sm font-medium text-zinc-700">
          App name
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">Shown in the navigation bar, the sign-in page, and the browser tab.</p>
        <input
          id="appName"
          name="appName"
          type="text"
          required
          defaultValue={settings.appName}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="locations" className="block text-sm font-medium text-zinc-700">
          Location quick-picks
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">One per line. These appear as suggestions on a product's Location field — any other city can still be typed in.</p>
        <textarea
          id="locations"
          name="locations"
          rows={4}
          defaultValue={settings.locations.join("\n")}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="accentColor" className="block text-sm font-medium text-zinc-700">
          Accent color
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">Used for primary buttons and the app name in the nav bar.</p>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="accentColorPicker"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-11 rounded-md border border-zinc-300 p-1"
            aria-label="Pick accent color"
          />
          <input
            id="accentColor"
            name="accentColor"
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            pattern="^#[0-9a-fA-F]{6}$"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
