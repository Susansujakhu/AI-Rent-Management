import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { initWhatsApp, disconnectWhatsApp, getWAStatus } from "@/lib/whatsapp";

export async function POST() {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;
  const key = auth.id; // per-user WhatsApp session

  const status = getWAStatus(key);
  if (status === "ready") {
    return NextResponse.json({ ok: true, message: "Already connected" });
  }
  if (status === "connecting" || status === "qr") {
    return NextResponse.json({ ok: true, message: "Already initializing" });
  }

  // Fire-and-forget — client.initialize() is slow (launches Chromium)
  initWhatsApp(key).catch(err => console.error("[whatsapp] Failed to initialize session:", err));

  return NextResponse.json({ ok: true, message: "Connecting…" });
}

export async function DELETE() {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  await disconnectWhatsApp(auth.id);
  return NextResponse.json({ ok: true });
}
