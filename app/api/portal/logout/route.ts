import { NextResponse } from "next/server";

// Token-in-URL portals don't have sessions to clear.
// This endpoint exists for backward compatibility with legacy cookie sessions.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("rms_tenant_session", "", { path: "/", maxAge: 0 });
  return res;
}
