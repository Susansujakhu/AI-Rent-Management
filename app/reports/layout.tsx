import { requireAuth } from "@/lib/auth";
export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
