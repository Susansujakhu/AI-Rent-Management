import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ForgotPasswordForm } from "./forgot-form";

export default async function ForgotPasswordPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_session")?.value;
  if (token) {
    const session = await prisma.session.findUnique({ where: { token } });
    if (session && session.expiresAt > new Date()) redirect("/");
  }
  return <ForgotPasswordForm />;
}
