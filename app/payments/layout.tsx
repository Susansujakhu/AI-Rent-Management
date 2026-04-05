import { requireAuth } from "@/lib/auth";
export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
