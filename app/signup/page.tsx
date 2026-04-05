import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  // If already logged in, go to dashboard
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_session")?.value;
  if (token) {
    const session = await prisma.session.findUnique({ where: { token } });
    if (session && session.expiresAt > new Date()) redirect("/");
  }

  return <SignupForm />;
}
