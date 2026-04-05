import { requireAuth } from "@/lib/auth";
export default async function ExpensesLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
