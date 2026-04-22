import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth";
import { initWhatsApp, disconnectWhatsApp, getWASession, getWAStatus, SYSTEM_WA_KEY } from "@/lib/whatsapp";

// GET — system WhatsApp status
export async function GET() {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(getWASession(SYSTEM_WA_KEY));
}

// POST — connect system WhatsApp
export async function POST() {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  const status = getWAStatus(SYSTEM_WA_KEY);
  if (status === "ready") {
    return NextResponse.json({ ok: true, message: "Already connected" });
  }
  if (status === "connecting" || status === "qr") {
    return NextResponse.json({ ok: true, message: "Already initializing" });
  }

  initWhatsApp(SYSTEM_WA_KEY).catch(err => console.error("[whatsapp] Failed to initialize system session:", err));

  return NextResponse.json({ ok: true, message: "Connecting…" });
}

// DELETE — disconnect system WhatsApp
export async function DELETE() {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  await disconnectWhatsApp(SYSTEM_WA_KEY);
  return NextResponse.json({ ok: true });
}
