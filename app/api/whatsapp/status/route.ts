import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { getWASession } from "@/lib/whatsapp";

export async function GET() {
  const auth = await requireAuthAPI();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(getWASession(auth.id));
}
