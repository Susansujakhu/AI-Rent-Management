import { requireAuth } from "@/lib/auth";
export default async function TenantsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
