import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAPIByToken } from "@/lib/tenant-auth";
import { createNotification } from "@/lib/notifications";

const VALID_CATEGORIES = ["PLUMBING", "ELECTRICAL", "APPLIANCE", "STRUCTURAL", "PEST", "OTHER"];
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export async function GET(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const requests = await prisma.maintenanceRequest.findMany({
    where:   { tenantId: tenant!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id:          true,
      title:       true,
      description: true,
      category:    true,
      priority:    true,
      status:      true,
      notes:       true,
      resolvedAt:  true,
      createdAt:   true,
    },
  });

  return NextResponse.json(requests);
}

export async function POST(req: Request) {
  const { tenant, unauth } = await requireTenantAPIByToken(req);
  if (unauth) return unauth;

  const t    = tenant!;
  const body = await req.json() as {
    title?:       string;
    description?: string;
    category?:    string;
    priority?:    string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const priority = VALID_PRIORITIES.includes(body.priority ?? "") ? body.priority! : "MEDIUM";
  const request = await prisma.maintenanceRequest.create({
    data: {
      userId:      t.userId,
      tenantId:    t.id,
      title:       body.title.trim(),
      description: body.description?.trim() || null,
      category:    VALID_CATEGORIES.includes(body.category ?? "") ? body.category! : "OTHER",
      priority,
    },
  });

  // Notify the owner (in-app + WhatsApp via createNotification).
  const urgentTag = priority === "URGENT" ? "🔴 URGENT — " : priority === "HIGH" ? "🟠 " : "";
  await createNotification(
    t.userId,
    "maintenance_submitted",
    `🔧 ${t.name} submitted a maintenance request`,
    `${urgentTag}${request.title}${body.description?.trim() ? `\n\n${body.description.trim()}` : ""}`,
    { tenantId: t.id, requestId: request.id },
  ).catch(() => null);

  return NextResponse.json(request, { status: 201 });
}
