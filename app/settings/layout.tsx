import { requireAuth } from "@/lib/auth";
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
