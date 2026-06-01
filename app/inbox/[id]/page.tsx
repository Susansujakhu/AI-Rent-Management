export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { ReplyBox } from "./reply-box";

function timeStamp(d: Date) {
  return d.toLocaleString("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default async function InboxThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { requireAuth } = await import("@/lib/auth");
  const user = await requireAuth();
  const { id } = await params;

  const tenant = await prisma.tenant.findFirst({
    where:  { id, userId: user.id },
    select: { id: true, name: true, phone: true, room: { select: { name: true } } },
  });
  if (!tenant) notFound();

  const messages = await prisma.whatsAppMessage.findMany({
    where:   { userId: user.id, tenantId: id },
    orderBy: { createdAt: "asc" },
  });

  // Mark any unread incoming messages as read now that the owner is viewing
  // the thread. Fire-and-forget; the rendered list above is already in hand.
  prisma.whatsAppMessage.updateMany({
    where: { userId: user.id, tenantId: id, direction: "in", readByOwner: false },
    data:  { readByOwner: true },
  }).catch(() => null);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <Link href="/inbox" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-sm font-black shrink-0">
          {tenant.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{tenant.name}</p>
          <p className="text-xs text-slate-400 truncate">
            {tenant.room?.name ? `${tenant.room.name} · ` : ""}{tenant.phone ?? "—"}
          </p>
        </div>
        <Link
          href={`/tenants/${tenant.id}`}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
        >
          Open profile
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 px-1 space-y-2 mt-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <MessageCircle size={28} className="text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">Send a message to start the conversation.</p>
          </div>
        ) : (
          messages.map(m => {
            const isOut = m.direction === "out";
            return (
              <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"} px-2`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                  isOut
                    ? "bg-emerald-500 text-white rounded-br-md"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md"
                }`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${isOut ? "text-emerald-100" : "text-slate-400"}`}>
                    {timeStamp(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply box */}
      {tenant.phone ? (
        <ReplyBox tenantId={tenant.id} />
      ) : (
        <div className="shrink-0 mt-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs text-slate-500 text-center">
          This tenant has no phone number on file — add one to send WhatsApp messages.
        </div>
      )}
    </div>
  );
}
