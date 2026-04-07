import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Home } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortalLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Redirect to dashboard if already logged in
  const cookieStore = await cookies();
  const token = cookieStore.get("rms_tenant_session")?.value;
  if (token) {
    const session = await prisma.tenantSession.findUnique({ where: { token } });
    if (session && session.expiresAt > new Date()) {
      redirect("/portal/dashboard");
    }
  }

  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto shadow-lg shadow-teal-200">
            <Home size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tenant Portal</h1>
            <p className="text-sm text-slate-500 mt-1">View your rent and payment details</p>
          </div>
        </div>

        {/* Error */}
        {error === "invalid" && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 text-center">
            This access link is invalid or has been revoked. Please contact your landlord for a new link.
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-800 text-sm">How to access your portal</h2>
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
              <span>Ask your landlord to enable your portal access and send you the link</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
              <span>Open the link sent via WhatsApp — you&apos;ll be signed in automatically</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
              <span>Bookmark the dashboard page so you can return anytime</span>
            </li>
          </ol>
        </div>

        <p className="text-xs text-center text-slate-400">Your access link is personal — don&apos;t share it with others.</p>
      </div>
    </div>
  );
}
