import { prisma } from "./prisma";

/**
 * Create an in-app notification for an owner AND mirror it to their WhatsApp.
 *
 * Every owner-facing event (payment reported, meter reading submitted,
 * maintenance request, …) flows through here, so adding the WhatsApp mirror
 * in one place covers them all. The WhatsApp send is best-effort: it never
 * blocks or fails the notification (or the tenant action that triggered it).
 *
 * Pass `{ whatsapp: false }` to suppress the WhatsApp mirror for a specific
 * notification (e.g. when the caller sends its own richer message).
 */
export async function createNotification(
  userId:  string,
  type:    string,
  title:   string,
  body:    string,
  data?:   Record<string, unknown>,
  options?: { whatsapp?: boolean },
) {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ? JSON.stringify(data) : null,
    },
  });

  if (options?.whatsapp === false) return;

  // Mirror to the owner's WhatsApp — wrapped so a WhatsApp failure can never
  // bubble up and break the notification / the request that created it.
  try {
    const owner = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!owner?.phone) return;

    const { sendWhatsAppMessage, isWhatsAppReady } = await import("./whatsapp");
    if (!(await isWhatsAppReady())) return;

    await sendWhatsAppMessage(owner.phone, `*${title}*\n\n${body}`);
  } catch (err) {
    console.error("[notifications] WhatsApp mirror failed:", err);
  }
}
