import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/transactions");

  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Change how the app looks and a couple of built-in defaults. No code required.
        </p>
      </div>

      <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-5">
        <SettingsForm key={settings.updatedAtIso} settings={settings} />
      </div>
    </div>
  );
}
