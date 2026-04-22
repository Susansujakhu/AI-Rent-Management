import { requireAdmin } from "@/lib/auth";
import AdminClient from "./admin-client";

export default async function AdminPage() {
  await requireAdmin(); // redirects to / if not admin
  return <AdminClient />;
}
