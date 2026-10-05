import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { appName, companyName } = await getSettings();
  return <LoginForm brand={companyName || appName} />;
}
