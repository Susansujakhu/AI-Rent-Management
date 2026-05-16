import { NextResponse } from "next/server";

// Per-user WhatsApp sessions removed — messages now sent via WhatsApp Business API
export async function POST() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}
