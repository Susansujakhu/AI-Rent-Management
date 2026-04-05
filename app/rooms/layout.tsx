import { requireAuth } from "@/lib/auth";
export default async function RoomsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
