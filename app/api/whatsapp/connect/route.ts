import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { initWhatsApp, disconnectWhatsApp, getWAStatus } from "@/lib/whatsapp";

export async function POST() {
  const unauth = await requireAuthAPI();
  if (unauth) return unauth;

  const status = getWAStatus();
  if (status === "ready") {
    return NextResponse.json({ ok: true, message: "Already connected" });
  }
  if (status === "connecting" || status === "qr") {
    return NextResponse.json({ ok: true, message: "Already initializing" });
  }

  // Fire-and-forget — client.initialize() is slow (launches Chromium)
  initWhatsApp().catch(console.error);

  return NextResponse.json({ ok: true, message: "Connecting…" });
}

export async function DELETE() {
  const unauth = await requireAuthAPI();
  if (unauth) return unauth;

  await disconnectWhatsApp();
  return NextResponse.json({ ok: true });
}
