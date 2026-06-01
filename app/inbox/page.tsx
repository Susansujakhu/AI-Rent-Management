export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MessageCircle, ChevronRight } from "lucide-react";

function timeAgo(d: Date) {
  const diffMs = Date.now() - d.getTime();
  const mins   = Math.floor(diffMs / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default async function InboxPage() {
  const { requireAuth } = await import("@/lib/auth");
  const user = await requireAuth();

  // Most recent first — we fold into conversations below.
  const messages = await prisma.whatsAppMessage.findMany({
    where:   { userId: user.id, tenantId: { not: null } },
    include: { tenant: { select: { id: true, name: true, phone: true, room: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  type Convo = {
    tenantId:     string;
    tenantName:   string;
    roomName:     string | null;
    lastBody:     string;
    lastDirection: "in" | "out";
    lastAt:       Date;
    unread:       number;
  };
  const byTenant = new Map<string, Convo>();
  for (const m of messages) {
    if (!m.tenantId || !m.tenant) continue;
    let conv = byTenant.get(m.tenantId);
    if (!conv) {
      conv = {
        tenantId:      m.tenantId,
        tenantName:    m.tenant.name,
        roomName:      m.tenant.room?.name ?? null,
        lastBody:      m.body,
        lastDirection: m.direction as "in" | "out",
        lastAt:        m.createdAt,
        unread:        0,
      };
      byTenant.set(m.tenantId, conv);
    }
    if (m.direction === "in" && !m.readByOwner) conv.unread++;
  }
  const conversations = Array.from(byTenant.values());

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
          <MessageCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Inbox</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Replies from tenants over WhatsApp</p>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-10 text-center">
          <MessageCircle size={28} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No messages yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Tenant replies to your receipts and reminders will land here.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {conversations.map(c => (
            <Link
              key={c.tenantId}
              href={`/inbox/${c.tenantId}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shrink-0 flex items-center justify-center text-white text-sm font-black">
                {c.tenantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.tenantName}</p>
                  {c.roomName && <span className="text-[11px] text-slate-400 shrink-0">· {c.roomName}</span>}
                </div>
                <p className={`text-xs truncate mt-0.5 ${
                  c.unread > 0 ? "text-slate-700 dark:text-slate-300 font-semibold" : "text-slate-400"
                }`}>
                  {c.lastDirection === "out" && <span className="text-slate-400">You: </span>}
                  {c.lastBody}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[11px] text-slate-400">{timeAgo(c.lastAt)}</span>
                {c.unread > 0 ? (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">
                    {c.unread > 9 ? "9+" : c.unread}
                  </span>
                ) : (
                  <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
