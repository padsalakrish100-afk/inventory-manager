import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { appName } = await getSettings();
  return <LoginForm appName={appName} />;
}
