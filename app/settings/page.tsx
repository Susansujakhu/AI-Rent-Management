import { requireAuth } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const user = await requireAuth();
  return <SettingsClient isPro={isPro(user)} />;
}
