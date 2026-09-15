import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Your account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Signed in as {session.user.name} (@{session.user.username})
        </p>
      </div>

      <div className="max-w-sm rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-medium text-zinc-900">Change password</h2>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
