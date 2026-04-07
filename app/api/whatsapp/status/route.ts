import { NextResponse } from "next/server";
import { requireAuthAPI } from "@/lib/auth";
import { getWAStatus, getWAQRImage, getWAPhone } from "@/lib/whatsapp";

export async function GET() {
  const unauth = await requireAuthAPI();
  if (unauth) return unauth;

  return NextResponse.json({
    status:  getWAStatus(),
    qrImage: getWAQRImage(),
    phone:   getWAPhone(),
  });
}
