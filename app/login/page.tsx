import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // If already logged in with a valid session, go to dashboard
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_session")?.value;
  if (token) {
    const session = await prisma.session.findUnique({
      where: { token },
    });
    if (session && session.expiresAt > new Date()) redirect("/");
  }

  return <LoginForm />;
}
