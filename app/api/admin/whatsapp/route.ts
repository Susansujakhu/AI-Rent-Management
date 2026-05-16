import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth";
import { isWhatsAppConfigured, getWAMode, invalidateWAModeCache } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  const mode          = await getWAMode();
  const apiConfigured = isWhatsAppConfigured();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? null;

  const { getDirectWASession } = await import("@/lib/whatsapp-direct");
  const directSession = getDirectWASession();

  return NextResponse.json({
    mode,
    api: {
      configured:    apiConfigured,
      phoneNumberId: phoneNumberId ? `...${phoneNumberId.slice(-6)}` : null,
    },
    direct: directSession,
  });
}

export async function POST(req: Request) {
  const auth = await requireAdminAPI();
  if (auth instanceof NextResponse) return auth;

  const body   = await req.json() as { action: string; mode?: "api" | "direct" };
  const { action } = body;

  if (action === "set_mode") {
    const newMode: "api" | "direct" = body.mode === "direct" ? "direct" : "api";
    await prisma.globalSetting.upsert({
      where:  { key: "wa_mode" },
      create: { key: "wa_mode", value: newMode },
      update: { value: newMode },
    });
    invalidateWAModeCache();

    if (newMode === "direct") {
      const { initDirectWA } = await import("@/lib/whatsapp-direct");
      initDirectWA().catch(console.error);
    } else {
      const { disconnectDirectWA } = await import("@/lib/whatsapp-direct");
      disconnectDirectWA().catch(console.error);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "connect_direct") {
    const { initDirectWA } = await import("@/lib/whatsapp-direct");
    initDirectWA().catch(console.error);
    return NextResponse.json({ ok: true });
  }

  if (action === "disconnect_direct") {
    const { disconnectDirectWA } = await import("@/lib/whatsapp-direct");
    await disconnectDirectWA();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
