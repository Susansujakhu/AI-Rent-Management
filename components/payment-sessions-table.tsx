"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatRentalPeriod } from "@/lib/utils";
import {
  X, MessageCircle, Receipt, ExternalLink,
  History, Loader2, CreditCard, ChevronDown, Users, Bell,
} from "lucide-react";
import { createPortal } from "react-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CoveredItem = {
  paymentId:    string;
  month:        string;
  roomName:     string;
  moveInDay:    number;
  amount:       number;
  creditAmount: number;
  status:       string;
  amountDue:    number;
  amountPaid:   number;
  note:         string | null;
};

export type PaymentSession = {
  key:            string;
  tenantId:       string;
  tenantName:     string;
  tenantPhone:    string | null;
  whatsappNotify: boolean;
  paidAt:         string;
  method:         string | null;
  totalReceived:  number;
  covered:        CoveredItem[];
};

export type PendingRow = {
  type:           "payment" | "charge";
  id:             string;
  tenantId:       string;
  tenantName:     string;
  roomName?:      string;
  title?:         string;
  date?:          string;
  month?:         string;
  moveInDay?:     number;
  amountDue:      number;
  amountPaid:     number;
  status:         string;
  tenantPhone?:   string | null;
  whatsappNotify?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  PARTIAL: "bg-blue-50 text-blue-700 border border-blue-200",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  OVERDUE: "bg-rose-50 text-rose-700 border border-rose-200",
};
const STATUS_DOT: Record<string, string> = {
  PAID: "bg-emerald-500", PARTIAL: "bg-blue-500", PENDING: "bg-amber-400", OVERDUE: "bg-rose-500",
};
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status] ?? "bg-slate-400"}`} />
      {status}
    </span>
  );
}

function TenantAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-orange-100 text-orange-700", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700"];
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${colors[name.charCodeAt(0) % colors.length]}`}>
      {initials}
    </div>
  );
}

// ── Session detail drawer ─────────────────────────────────────────────────────

function SessionDetailDrawer({
  session, fmt, isPro, onClose,
}: {
  session: PaymentSession;
  fmt: (n: number) => string;
  isPro: boolean;
  onClose: () => void;
}) {
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Use the first covered payment's ID as the initiating payment for the notification
  const initiatingPaymentId = session.covered[0]?.paymentId;
  const canSendReceipt = isPro && !!session.tenantPhone && session.whatsappNotify && session.totalReceived > 0 && !!initiatingPaymentId;

  const sendReceipt = async () => {
    if (!initiatingPaymentId) return;
    setSending(true);
    try {
      const res  = await fetch(`/api/payments/${initiatingPaymentId}/notify`, { method: "POST" });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Failed to send");
      else toast.success("Payment receipt sent via WhatsApp ✅");
    } catch { toast.error("Failed to send"); }
    finally { setSending(false); }
  };

  const creditItem = session.covered.find(c => c.creditAmount > 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <TenantAvatar name={session.tenantName} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 truncate">{session.tenantName}</p>
            <p className="text-xs text-slate-400">{formatDate(session.paidAt)} · {session.method ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Total received */}
        <div className="px-5 py-4 bg-emerald-50/50 border-b border-emerald-100/60">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Received</p>
          <p className="text-2xl font-black text-emerald-700 tracking-tight">{fmt(session.totalReceived)}</p>
        </div>

        {/* Covered breakdown */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <History size={13} className="text-slate-400" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Applied To</p>
          </div>
          <div className="space-y-2">
            {session.covered.map((c, i) => (
              <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-800">
                    {formatRentalPeriod(c.month, c.moveInDay)}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{c.roomName}</span>
                  <span className="font-bold text-slate-700">{fmt(c.amount)}</span>
                </div>
                {c.status === "PARTIAL" && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Balance remaining: {fmt(c.amountDue - c.amountPaid)}
                  </p>
                )}
                {c.note && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate" title={c.note}>{c.note}</p>
                )}
              </div>
            ))}
            {creditItem && creditItem.creditAmount > 0 && (
              <div className="bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700">Credit Added to Account</span>
                  <span className="text-xs font-bold text-emerald-700">+{fmt(creditItem.creditAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 space-y-2">
          {canSendReceipt && (
            <button onClick={sendReceipt} disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
              <MessageCircle size={14} className={sending ? "animate-pulse" : ""} />
              {sending ? "Sending…" : "Send Payment Receipt via WhatsApp"}
            </button>
          )}
          <div className="flex gap-2">
            {initiatingPaymentId && session.totalReceived > 0 && (
              <Link href={`/payments/${initiatingPaymentId}/receipt`}
                className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors">
                <Receipt size={12} />Receipt
              </Link>
            )}
            <Link href={`/tenants/${session.tenantId}`}
              className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors">
              <ExternalLink size={12} />Tenant Page
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Pending row reminder button ────────────────────────────────────────────────

function ReminderButton({ paymentId, status }: { paymentId: string; status: string }) {
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try {
      const res  = await fetch("/api/whatsapp/send-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId, type: status === "OVERDUE" ? "overdue" : "due" }) });
      const data = await res.json() as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Failed"); else toast.success("Reminder sent ✅");
    } catch { toast.error("Failed"); } finally { setSending(false); }
  };
  return (
    <button onClick={send} disabled={sending} title="Send WhatsApp reminder"
      className="flex items-center gap-1 text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40 font-medium">
      <Bell size={11} className={sending ? "animate-pulse" : ""} />
      {sending ? "…" : "Remind"}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PENDING", label: "Pending" },
  { value: "OVERDUE", label: "Overdue" },
];

export function PaymentSessionsTable({
  sessions,
  pending,
  currencySymbol,
  isPro,
}: {
  sessions:       PaymentSession[];
  pending:        PendingRow[];
  currencySymbol: string;
  isPro:          boolean;
}) {
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  const tenantNames = Array.from(new Set([
    ...sessions.map(s => s.tenantName),
    ...pending.map(p => p.tenantName),
  ])).sort();

  const [tenantFilter, setTenantFilter] = useState("");
  const [detail, setDetail] = useState<PaymentSession | null>(null);

  const filteredSessions = sessions.filter(s => !tenantFilter || s.tenantName === tenantFilter);

  // Only show pending rows when a tenant is selected
  const filteredPending = tenantFilter
    ? pending.filter(p => p.tenantName === tenantFilter && p.amountPaid < p.amountDue)
    : [];

  const filteredTotal = filteredSessions.reduce((s, x) => s + x.totalReceived, 0);

  return (
    <div>
      {/* ── Tenant picker ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2 bg-slate-100/80 rounded-full p-1">
          {tenantFilter && (
            <button onClick={() => setTenantFilter("")}
              className="flex items-center justify-center w-7 h-7 rounded-full text-slate-500 hover:bg-white hover:text-slate-700 transition-all"
              title="Show all tenants">
              <X size={13} />
            </button>
          )}
          <div className="relative flex items-center">
            <Users size={13} className="absolute left-3 text-slate-400 pointer-events-none z-10" />
            <select
              value={tenantFilter}
              onChange={e => setTenantFilter(e.target.value)}
              className="appearance-none pl-8 pr-8 py-1.5 rounded-full bg-white shadow-sm text-sm font-semibold text-slate-800 border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer min-w-[200px]"
            >
              <option value="">All Tenants</option>
              {tenantNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Summary for filtered tenant ──────────────────────────────────── */}
      {tenantFilter && (
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-6 text-xs text-slate-500">
          <span>{filteredSessions.length} payment session{filteredSessions.length !== 1 ? "s" : ""}</span>
          {filteredTotal > 0 && <span className="font-semibold text-emerald-600">{fmt(filteredTotal)} received</span>}
          {filteredPending.length > 0 && (
            <span className="font-semibold text-amber-600">{filteredPending.length} pending/partial bill{filteredPending.length !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}

      {/* ── Pending bills (only when tenant selected) ────────────────────── */}
      {filteredPending.length > 0 && (
        <div className="border-b border-amber-100 bg-amber-50/30">
          <div className="px-5 py-2.5">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Unpaid / Partial Bills</p>
          </div>
          <div className="divide-y divide-amber-50">
            {filteredPending.map(r => (
              <div key={`pending-${r.id}`} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  {r.type === "payment" && r.month && r.moveInDay ? (
                    <p className="text-sm font-semibold text-slate-800">
                      {formatRentalPeriod(r.month, r.moveInDay)}
                      {r.roomName && <span className="ml-2 text-xs text-slate-400">{r.roomName}</span>}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-800">
                      {r.title}
                      {r.date && <span className="ml-2 text-xs text-slate-400">{formatDate(r.date)}</span>}
                      <span className="ml-1.5 text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded uppercase">Charge</span>
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                    <span>Due <span className="font-semibold text-slate-600">{fmt(r.amountDue)}</span></span>
                    {r.amountPaid > 0 && <span>Paid <span className="font-semibold text-slate-700">{fmt(r.amountPaid)}</span></span>}
                    {r.amountPaid < r.amountDue && <span className="font-semibold text-amber-600">Bal {fmt(r.amountDue - r.amountPaid)}</span>}
                  </div>
                </div>
                <StatusBadge status={r.status} />
                <div className="flex items-center gap-1.5">
                  {r.type === "payment" && (
                    <>
                      <Link href={`/payments/${r.id}/pay`}
                        className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 font-semibold transition-colors whitespace-nowrap">
                        Add Payment
                      </Link>
                      {r.tenantPhone && r.whatsappNotify && isPro && (
                        <ReminderButton paymentId={r.id} status={r.status} />
                      )}
                    </>
                  )}
                  {r.type === "charge" && (
                    <Link href={`/tenants/${r.tenantId}`}
                      className="text-xs text-indigo-600 font-semibold hover:underline">
                      View →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sessions table — desktop ──────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        {filteredSessions.length === 0 ? (
          <div className="p-14 text-center text-slate-400 text-sm">
            {tenantFilter ? `No payment history for ${tenantFilter}.` : "No payment history yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-slate-50/40">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                {!tenantFilter && (
                  <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant</th>
                )}
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Covers</th>
                <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Received</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSessions.map(s => {
                const creditItem = s.covered.find(c => c.creditAmount > 0);
                return (
                  <tr key={s.key} onClick={() => setDetail(s)}
                    className="group cursor-pointer hover:bg-slate-50/70 transition-colors">

                    {/* Date */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="text-sm font-semibold text-slate-800">{formatDate(s.paidAt)}</p>
                    </td>

                    {/* Tenant (only when all selected) */}
                    {!tenantFilter && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <TenantAvatar name={s.tenantName} />
                          <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{s.tenantName}</span>
                        </div>
                      </td>
                    )}

                    {/* Covers */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        {s.covered.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-slate-700 font-medium">{formatRentalPeriod(c.month, c.moveInDay)}</span>
                            <span className="text-slate-400">{fmt(c.amount)}</span>
                            {c.status === "PARTIAL" && (
                              <span className="text-amber-500 font-semibold">(partial)</span>
                            )}
                            {c.status === "PAID" && (
                              <span className="text-emerald-500">✓</span>
                            )}
                          </div>
                        ))}
                        {creditItem && creditItem.creditAmount > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-emerald-600 font-semibold">+{fmt(creditItem.creditAmount)} credit</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Total received */}
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-base font-black text-slate-900">{fmt(s.totalReceived)}</span>
                    </td>

                    {/* Method */}
                    <td className="px-4 py-3.5 text-xs text-slate-400">{s.method ?? "—"}</td>

                    {/* Arrow */}
                    <td className="px-4 py-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors">
                      <ChevronDown size={14} className="-rotate-90" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Sessions — mobile ────────────────────────────────────────────── */}
      <div className="divide-y divide-slate-50 sm:hidden">
        {filteredSessions.map(s => {
          const creditItem = s.covered.find(c => c.creditAmount > 0);
          return (
            <div key={s.key} onClick={() => setDetail(s)} className="p-4 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2.5">
                  {!tenantFilter && <TenantAvatar name={s.tenantName} />}
                  <div>
                    {!tenantFilter && <p className="font-bold text-slate-900 text-sm">{s.tenantName}</p>}
                    <p className="text-xs text-slate-400">{formatDate(s.paidAt)}{s.method ? ` · ${s.method}` : ""}</p>
                  </div>
                </div>
                <p className="text-base font-black text-slate-900">{fmt(s.totalReceived)}</p>
              </div>
              <div className="space-y-0.5 ml-0 sm:ml-9">
                {s.covered.map((c, i) => (
                  <p key={i} className="text-xs text-slate-500">
                    {formatRentalPeriod(c.month, c.moveInDay)} — {fmt(c.amount)}
                    {c.status === "PARTIAL" && <span className="text-amber-500 ml-1">(partial)</span>}
                    {c.status === "PAID" && <span className="text-emerald-500 ml-1">✓</span>}
                  </p>
                ))}
                {creditItem && creditItem.creditAmount > 0 && (
                  <p className="text-xs text-emerald-600 font-semibold">+{fmt(creditItem.creditAmount)} credit</p>
                )}
              </div>
            </div>
          );
        })}
        {filteredSessions.length === 0 && (
          <div className="p-10 text-center text-slate-400 text-sm">No payment history yet.</div>
        )}
      </div>

      {/* Detail drawer */}
      {detail && (
        <SessionDetailDrawer
          key={detail.key}
          session={detail}
          fmt={fmt}
          isPro={isPro}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
