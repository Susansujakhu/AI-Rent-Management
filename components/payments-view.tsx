"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Users, ChevronDown, X, MessageCircle, Receipt,
  ExternalLink, CreditCard, Bell, CheckCircle2,
  AlertCircle, ChevronRight, RotateCcw, ChevronLeft, Calendar,
} from "lucide-react";
import { createPortal } from "react-dom";
import { BreakdownLines, type BreakdownData } from "@/components/breakdown-lines";

// ── Paginator ─────────────────────────────────────────────────────────────────

function Paginator({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);
  const pages: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i);
  return (
    <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60">
      <span className="text-xs text-slate-400">{start}–{end} of {total}</span>
      <div className="flex items-center gap-0.5">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={14} />
        </button>
        {pages[0] > 1 && <span className="px-1 text-slate-300 text-xs">…</span>}
        {pages.map(p => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-7 h-7 text-xs font-semibold rounded-lg transition-colors ${
              p === page ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}>
            {p}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages && <span className="px-1 text-slate-300 text-xs">…</span>}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionLine = {
  type:          "payment" | "charge";
  paymentId?:    string;
  chargeId?:     string;
  label:         string;
  amount:        number;
  creditAmount:  number;
  status:        string;
  amountDue:     number;
  amountPaid:    number;
};

export type ReceivedSession = {
  key:            string;
  tenantId:       string;
  tenantName:     string;
  tenantPhone:    string | null;
  whatsappNotify: boolean;
  paidAt:         string;
  method:         string | null;
  total:          number;
  lines:          SessionLine[];
};

export type OpenBill = {
  type:            "payment" | "charge";
  id:              string;
  tenantId:        string;
  tenantName:      string;
  label:           string;
  month:           string;
  amountDue:       number;
  amountPaid:      number;
  status:          string;
  tenantPhone?:    string | null;
  whatsappNotify?: boolean;
  breakdown?:      BreakdownData;
};

type BillGroup = {
  key:            string;
  tenantId:       string;
  tenantName:     string;
  tenantPhone?:   string | null;
  whatsappNotify?: boolean;
  month:          string;
  periodLabel:    string;
  status:         string;
  totalDue:       number;
  totalPaid:      number;
  items:          OpenBill[];
  paymentId?:     string;
};

const STATUS_RANK: Record<string, number> = { OVERDUE: 0, PARTIAL: 1, PENDING: 2 };

function groupOpenBills(bills: OpenBill[]): BillGroup[] {
  const map = new Map<string, BillGroup>();
  for (const b of bills) {
    const key = `${b.tenantId}:${b.month}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        tenantId:       b.tenantId,
        tenantName:     b.tenantName,
        tenantPhone:    b.tenantPhone,
        whatsappNotify: b.whatsappNotify,
        month:          b.month,
        periodLabel:    b.label,
        status:         b.status,
        totalDue:       0,
        totalPaid:      0,
        items:          [],
        paymentId:      b.type === "payment" ? b.id : undefined,
      });
    }
    const g = map.get(key)!;
    g.totalDue  += b.amountDue;
    g.totalPaid += b.amountPaid;
    g.items.push(b);
    if (b.type === "payment") {
      g.paymentId     = b.id;
      g.periodLabel   = b.label;
      g.tenantPhone   = b.tenantPhone;
      g.whatsappNotify = b.whatsappNotify;
    }
    if ((STATUS_RANK[b.status] ?? 9) < (STATUS_RANK[g.status] ?? 9)) g.status = b.status;
  }
  return Array.from(map.values());
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TenantAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = [
    "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400",
    "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
    "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
    "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400",
    "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400",
  ];
  const cls = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  return (
    <div className={`${cls} rounded-full flex items-center justify-center font-bold shrink-0 ${colors[name.charCodeAt(0) % colors.length]}`}>
      {initials}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  OVERDUE: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/20",
  PARTIAL: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/20",
  PENDING: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/20",
};
const STATUS_DOT: Record<string, string> = {
  OVERDUE: "bg-rose-500", PARTIAL: "bg-blue-500", PENDING: "bg-amber-400",
};

// ── Tenant dropdown chip ──────────────────────────────────────────────────────

function TenantDropdown({ names, value, onChange }: {
  names: string[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const active = !!value;
  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all duration-150 select-none
          ${active
            ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-300"
          }
          ${open ? (active ? "bg-indigo-100 shadow-sm" : "bg-slate-200 dark:bg-slate-700 shadow-sm") : ""}
        `}
      >
        <Users size={13} className={active ? "text-indigo-500" : "text-slate-400"} />
        <span className="max-w-[120px] truncate">{value || "All Tenants"}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${active ? "text-indigo-400" : "text-slate-400"}`} />
      </button>

      {open && (
        <div ref={panelRef}
          className="absolute top-full right-0 sm:right-auto sm:left-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden py-1 max-w-[calc(100vw-1rem)]"
          style={{ minWidth: 180 }}>
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors
              ${!value ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-bold" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"}`}
          >
            All Tenants
          </button>
          {names.length > 0 && <div className="border-t border-slate-100 dark:border-slate-800 my-1" />}
          {names.map(n => (
            <button key={n}
              onClick={() => { onChange(n); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2.5
                ${value === n ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-bold" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              <TenantAvatar name={n} size="sm" />
              <span className="truncate">{n}</span>
              {value === n && <span className="ml-auto text-indigo-500 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Date range chip ───────────────────────────────────────────────────────────

function dateLabel(dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) return "All dates";
  const f = dateFrom ? new Date(dateFrom + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" }) : "…";
  const t = dateTo   ? new Date(dateTo   + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" }) : "…";
  return `${f} – ${t}`;
}

function DateRangeChip({ dateFrom, dateTo, onDateFrom, onDateTo }: {
  dateFrom: string; dateTo: string;
  onDateFrom: (v: string) => void; onDateTo: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const active = !!dateFrom || !!dateTo;
  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all duration-150 select-none
          ${active
            ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-300"
          }
          ${open ? (active ? "bg-indigo-100 shadow-sm" : "bg-slate-200 dark:bg-slate-700 shadow-sm") : ""}
        `}
      >
        <Calendar size={13} className={active ? "text-indigo-500" : "text-slate-400"} />
        <span>{dateLabel(dateFrom, dateTo)}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${active ? "text-indigo-400" : "text-slate-400"}`} />
      </button>

      {open && (
        <div ref={panelRef}
          className="absolute top-full right-0 sm:right-auto sm:left-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden max-w-[calc(100vw-1rem)]"
          style={{ minWidth: 256 }}
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-4 py-3">
            <p className="text-white font-bold text-sm">Date Range</p>
            <p className="text-indigo-200 text-xs mt-0.5">Filter payments by date received</p>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">From</label>
                <input type="date" value={dateFrom} onChange={e => onDateFrom(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">To</label>
                <input type="date" value={dateTo} onChange={e => onDateTo(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "This month", from: () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; }, to: () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; } },
                { label: "Last month", from: () => { const n = new Date(); n.setMonth(n.getMonth()-1); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01`; }, to: () => { const n = new Date(); const y = n.getMonth()===0?n.getFullYear()-1:n.getFullYear(); const m = n.getMonth()===0?12:n.getMonth(); return `${y}-${String(m).padStart(2,"0")}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`; } },
                { label: "Last 30 days", from: () => { const n = new Date(); n.setDate(n.getDate()-30); return n.toISOString().slice(0,10); }, to: () => new Date().toISOString().slice(0,10) },
                { label: "This year", from: () => `${new Date().getFullYear()}-01-01`, to: () => `${new Date().getFullYear()}-12-31` },
              ].map(p => (
                <button key={p.label}
                  onClick={() => { onDateFrom(p.from()); onDateTo(p.to()); }}
                  className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {active && (
              <button onClick={() => { onDateFrom(""); onDateTo(""); setOpen(false); }}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <X size={11} />Clear dates
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session detail drawer ─────────────────────────────────────────────────────

function SessionDrawer({ session, fmt, isPro, canVoid, onClose, onVoided }: {
  session: ReceivedSession; fmt: (n: number) => string; isPro: boolean;
  canVoid: boolean; onClose: () => void; onVoided: () => void;
}) {
  const [sending,     setSending]     = useState(false);
  const [voidConfirm, setVoidConfirm] = useState(false);
  const [voiding,     setVoiding]     = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const firstPaymentId = session.lines.find(l => l.type === "payment")?.paymentId;
  const canSend   = isPro && !!session.tenantPhone && session.whatsappNotify && !!firstPaymentId;
  const totalCredit = session.lines.reduce((s, l) => s + (l.creditAmount ?? 0), 0);
  const paymentIds  = session.lines.filter(l => l.type === "payment" && l.paymentId).map(l => l.paymentId!);

  const send = async () => {
    if (!firstPaymentId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/payments/${firstPaymentId}/notify`, { method: "POST" });
      const d   = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) toast.error(d.error ?? "Failed"); else toast.success("Receipt sent via WhatsApp ✅");
    } catch { toast.error("Failed"); } finally { setSending(false); }
  };

  const handleVoid = async () => {
    setVoiding(true);
    try {
      for (const pid of paymentIds) {
        const res = await fetch(`/api/payments/${pid}`, { method: "DELETE" });
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(d.error ?? "Failed to void payment");
        }
      }
      toast.success("Payment voided");
      onClose();
      onVoided();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to void");
    } finally {
      setVoiding(false);
      setVoidConfirm(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <TenantAvatar name={session.tenantName} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 dark:text-white">{session.tenantName}</p>
            <p className="text-xs text-slate-400">{formatDate(session.paidAt)}{session.method ? ` · ${session.method}` : ""}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Total */}
        <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Received</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{fmt(session.total)}</p>
        </div>

        {/* Breakdown */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Applied to</p>
          <div className="space-y-2">
            {session.lines.map((l, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">{l.label}</p>
                    {l.type === "charge" && (
                      <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">charge</span>
                    )}
                  </div>
                  {l.status === "PARTIAL" && (
                    <p className="text-xs text-amber-600 mt-0.5">{fmt(l.amountDue - l.amountPaid)} still remaining</p>
                  )}
                  {l.status === "PAID" && (
                    <p className="text-xs text-emerald-600 mt-0.5">Fully paid ✓</p>
                  )}
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm shrink-0">{fmt(l.amount)}</span>
              </div>
            ))}
            {totalCredit > 0 && (
              <div className="flex items-center justify-between py-2.5">
                <p className="text-sm font-semibold text-emerald-700">Credit added to account</p>
                <span className="font-bold text-emerald-700">+{fmt(totalCredit)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {canSend && (
            <button onClick={send} disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
              <MessageCircle size={14} className={sending ? "animate-pulse" : ""} />
              {sending ? "Sending…" : "Send Receipt via WhatsApp"}
            </button>
          )}
          <div className="flex gap-2">
            {firstPaymentId && session.lines.some(l => l.type === "payment") && (
              <Link href={`/payments/${firstPaymentId}/receipt`}
                className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Receipt size={12} />Receipt
              </Link>
            )}
            <Link href={`/tenants/${session.tenantId}`}
              className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ExternalLink size={12} />Tenant
            </Link>
          </div>
          {canVoid && paymentIds.length > 0 && (
            voidConfirm ? (
              <div className="flex gap-2">
                <button onClick={handleVoid} disabled={voiding}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-rose-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors">
                  <RotateCcw size={12} className={voiding ? "animate-spin" : ""} />
                  {voiding ? "Voiding…" : "Confirm Void"}
                </button>
                <button onClick={() => setVoidConfirm(false)} disabled={voiding}
                  className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setVoidConfirm(true)}
                className="w-full flex items-center justify-center gap-1.5 border border-rose-200 text-rose-600 py-2 rounded-xl text-xs font-semibold hover:bg-rose-50 transition-colors">
                <RotateCcw size={12} />Void this payment
              </button>
            )
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PaymentsView({ sessions, openBills, currencySymbol, isPro, initialTenant }: {
  sessions:       ReceivedSession[];
  openBills:      OpenBill[];
  currencySymbol: string;
  isPro:          boolean;
  initialTenant?: string;   // tenant NAME to preselect (e.g. from a notification deep-link)
}) {
  const fmt    = (n: number) => formatCurrency(n, currencySymbol);
  const router = useRouter();

  const tenantNames = Array.from(new Set([
    ...sessions.map(s => s.tenantName),
    ...openBills.map(b => b.tenantName),
  ])).sort();

  const TENANT_KEY = "er:payments:tenant";

  // Default filters: a deep-linked tenant wins; otherwise first tenant
  // alphabetically (localStorage restores the last-used value on mount).
  const currentYear = new Date().getFullYear();
  const [tenant,   setTenant]   = useState<string>(() =>
    (initialTenant && tenantNames.includes(initialTenant)) ? initialTenant : (tenantNames[0] ?? "")
  );
  const [dateFrom, setDateFrom] = useState<string>(`${currentYear}-01-01`);
  const [dateTo,   setDateTo]   = useState<string>(`${currentYear}-12-31`);

  // Restore the last-used tenant filter once on mount — unless a deep-link
  // explicitly asked for a tenant, which takes precedence.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (initialTenant) return;
    const saved = typeof window !== "undefined" ? localStorage.getItem(TENANT_KEY) : null;
    if (saved !== null && (saved === "" || tenantNames.includes(saved))) setTenant(saved);
  }, [initialTenant, tenantNames]);

  // Persist the tenant filter so the next visit lands where they left off.
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(TENANT_KEY, tenant);
  }, [tenant]);
  const [drawer,         setDrawer]         = useState<ReceivedSession | null>(null);
  const [sessionPage,    setSessionPage]    = useState(1);
  const [billPage,       setBillPage]       = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const SESSION_PAGE_SIZE = 10;
  const BILL_PAGE_SIZE    = 10;

  useEffect(() => { setSessionPage(1); setBillPage(1); }, [tenant, dateFrom, dateTo]);

  const hasFilter = !!tenant || !!dateFrom || !!dateTo;
  const clearFilters = () => { setTenant(""); setDateFrom(""); setDateTo(""); };

  const mostRecentKey = sessions[0]?.key ?? null;

  const visibleSessions = sessions.filter(s => {
    if (tenant && s.tenantName !== tenant) return false;
    if (dateFrom && new Date(s.paidAt) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(s.paidAt) > new Date(dateTo + "T23:59:59.999")) return false;
    return true;
  });
  const visibleBills  = openBills.filter(b => !tenant || b.tenantName === tenant);
  const billGroups    = groupOpenBills(visibleBills);
  const pagedSessions = visibleSessions.slice((sessionPage - 1) * SESSION_PAGE_SIZE, sessionPage * SESSION_PAGE_SIZE);
  const pagedGroups   = billGroups.slice((billPage - 1) * BILL_PAGE_SIZE, billPage * BILL_PAGE_SIZE);

  // ── Filter-reactive stats ──────────────────────────────────────────────────
  const totalCollected   = visibleSessions.reduce((s, x) => s + x.total, 0);
  const totalOutstanding = visibleBills.reduce((s, b) => s + (b.amountDue - b.amountPaid), 0);
  const overdueCount     = visibleBills.filter(b => b.status === "OVERDUE").length;
  const totalBilled      = totalCollected + totalOutstanding;
  const collectionRate   = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  return (
    <div className="space-y-4">

      {/* ── Hero stats card ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-6 shadow-xl text-white overflow-hidden relative">
        {/* Decorative glow */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Filtered indicator */}
          {hasFilter && (
            <div className="mb-4 inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/80 text-xs font-semibold px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Filtered view
              {tenant && <span className="text-white/60">· {tenant}</span>}
              {(dateFrom || dateTo) && <span className="text-white/60">· {dateLabel(dateFrom, dateTo)}</span>}
              <button onClick={clearFilters} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
                <X size={11} />
              </button>
            </div>
          )}

          {/* Stats — 2 cols on mobile, 3 cols on sm+ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-3 sm:gap-8">
            {/* Collected */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Collected</p>
              <p className="text-xl sm:text-3xl font-black text-white mt-1 tracking-tight leading-none tabular-nums">{fmt(totalCollected)}</p>
              <p className="text-xs text-emerald-400 mt-1.5 font-medium">{visibleSessions.length} payment{visibleSessions.length !== 1 ? "s" : ""}</p>
            </div>

            {/* Outstanding */}
            <div className="border-l border-slate-700 pl-3 sm:pl-8">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outstanding</p>
              <p className={`text-xl sm:text-3xl font-black mt-1 tracking-tight leading-none tabular-nums ${totalOutstanding > 0 ? "text-rose-400" : "text-slate-500"}`}>
                {fmt(totalOutstanding)}
              </p>
              {overdueCount > 0 ? (
                <p className="text-xs text-rose-400 mt-1.5 font-semibold">{overdueCount} overdue</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1.5">{visibleBills.length} open bill{visibleBills.length !== 1 ? "s" : ""}</p>
              )}
            </div>

            {/* Collection rate — spans full width on mobile, 1 col on sm+ */}
            <div className="col-span-2 sm:col-span-1 flex items-center gap-4 sm:block border-t sm:border-t-0 sm:border-l border-slate-700 pt-3 sm:pt-0 sm:pl-8">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Collection Rate</p>
                <p className="text-xl sm:text-3xl font-black text-white mt-1 tracking-tight leading-none">{collectionRate}%</p>
              </div>
              <p className="text-xs text-slate-400 sm:mt-1.5">of {fmt(totalBilled)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            {overdueCount > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                {overdueCount} overdue bill{overdueCount !== 1 ? "s" : ""} need attention
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter + sessions + bills card ──────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <TenantDropdown names={tenantNames} value={tenant} onChange={setTenant} />
          <DateRangeChip dateFrom={dateFrom} dateTo={dateTo} onDateFrom={setDateFrom} onDateTo={setDateTo} />
          {hasFilter && (
            <button onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-all">
              <X size={11} />Clear all
            </button>
          )}
          {hasFilter && (
            <span className="ml-auto text-xs text-slate-400">
              {visibleSessions.length} session{visibleSessions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── PAYMENT HISTORY ─────────────────────────────────────────────── */}
        <div className="border-b border-slate-100 dark:border-slate-800">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Payments Received</p>
            <p className="text-xs text-slate-400">{visibleSessions.length} session{visibleSessions.length !== 1 ? "s" : ""}</p>
          </div>

          {visibleSessions.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-400">
                {hasFilter ? "No payments match the current filters." : "No payments recorded yet."}
              </p>
              {hasFilter && (
                <button onClick={clearFilters} className="mt-2 text-xs text-indigo-600 font-semibold hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pagedSessions.map(s => {
                const totalCredit = s.lines.reduce((x, l) => x + (l.creditAmount ?? 0), 0);
                return (
                  <div key={s.key}>
                    {/* Session header */}
                    <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-800/70 flex items-center gap-3">
                      {!tenant && <TenantAvatar name={s.tenantName} size="sm" />}
                      <div className="flex-1 min-w-0">
                        {!tenant && <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">{s.tenantName}</p>}
                        <p className={`text-xs text-slate-400 ${!tenant ? "mt-0.5" : ""}`}>
                          {new Date(s.paidAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                          {s.method ? ` · ${s.method}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-base font-black text-slate-900 dark:text-white tracking-tight">{fmt(s.total)}</p>
                          {totalCredit > 0 && <p className="text-[10px] text-emerald-600 font-semibold">+{fmt(totalCredit)} credit</p>}
                        </div>
                        <button onClick={() => setDrawer(s)} title="Details & actions"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 transition-colors">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Individual lines */}
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {s.lines.map((l, i) => {
                        const balance = l.amountDue - l.amountPaid;
                        return (
                          <div key={i} className="px-5 py-2.5 flex items-center gap-3 pl-8">
                            <div className="w-px self-stretch bg-slate-100 dark:bg-slate-800 shrink-0 ml-1" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{l.label}</span>
                                {l.type === "charge" && (
                                  <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full leading-none">charge</span>
                                )}
                              </div>
                              {l.status === "PARTIAL" && (
                                <p className="text-xs text-amber-600 mt-0.5">{fmt(balance)} still remaining</p>
                              )}
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{fmt(l.amount)}</span>
                              {l.status === "PAID"    && <span className="text-emerald-500 text-xs font-bold">✓</span>}
                              {l.status === "PARTIAL" && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">partial</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Paginator page={sessionPage} total={visibleSessions.length} pageSize={SESSION_PAGE_SIZE} onChange={setSessionPage} />
        </div>

        {/* ── OPEN BILLS ──────────────────────────────────────────────────── */}
        {billGroups.length > 0 && (
          <div>
            <div className="px-5 py-3 flex items-center gap-2.5 bg-amber-50/60 dark:bg-amber-500/10 border-b border-amber-100/60 dark:border-amber-500/20">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                Open Bills
                <span className="ml-2 bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  {billGroups.length}
                </span>
              </p>
            </div>

            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {pagedGroups.map(g => {
                const balance    = g.totalDue - g.totalPaid;
                const colorCls   = STATUS_COLOR[g.status] ?? "text-slate-600 bg-slate-50 border-slate-200";
                const isMulti    = g.items.length > 1;
                const isExpanded = expandedGroups.has(g.key);
                const toggleExpand = () => setExpandedGroups(prev => {
                  const next = new Set(prev);
                  next.has(g.key) ? next.delete(g.key) : next.add(g.key);
                  return next;
                });

                return (
                  <div key={g.key} className={g.status === "OVERDUE" ? "border-l-2 border-rose-400" : ""}>
                    {/* Main row */}
                    <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {!tenant && <TenantAvatar name={g.tenantName} size="sm" />}
                        <div className="min-w-0 flex-1">
                          {!tenant && <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{g.tenantName}</p>}
                          <p className={`text-sm font-semibold text-slate-800 dark:text-slate-200 break-words sm:truncate ${tenant ? "" : "mt-0.5"}`}>
                            {g.periodLabel}
                          </p>
                          {isMulti ? (
                            <button
                              onClick={toggleExpand}
                              className="flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                            >
                              {g.items.length} items
                              {isExpanded
                                ? <ChevronDown size={11} className="rotate-180 transition-transform" />
                                : <ChevronDown size={11} className="transition-transform" />
                              }
                            </button>
                          ) : (
                            (() => {
                              const singlePayment = g.items.find(i => i.type === "payment");
                              return singlePayment?.breakdown
                                ? <BreakdownLines breakdown={singlePayment.breakdown} fmt={fmt} />
                                : null;
                            })()
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                        <div className="text-left sm:text-right shrink-0">
                          <p className="text-base font-black text-slate-900 dark:text-white">{fmt(balance)}</p>
                          {g.totalPaid > 0 && <p className="text-xs text-slate-400">{fmt(g.totalPaid)} paid</p>}
                        </div>
                        <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${colorCls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[g.status] ?? "bg-slate-400"}`} />
                          {g.status}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {g.paymentId ? (
                            <>
                              <Link href={`/payments/${g.paymentId}/pay`}
                                className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-bold transition-colors">
                                <CreditCard size={11} />Add Payment
                              </Link>
                              {g.tenantPhone && g.whatsappNotify && isPro && (
                                <button
                                  onClick={async () => {
                                    const res = await fetch("/api/whatsapp/send-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: g.paymentId, type: g.status === "OVERDUE" ? "overdue" : "due" }) });
                                    const d = await res.json() as { error?: string };
                                    if (!res.ok) toast.error(d.error ?? "Failed"); else toast.success("Reminder sent ✅");
                                  }}
                                  title="Send WhatsApp reminder"
                                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors">
                                  <Bell size={14} />
                                </button>
                              )}
                            </>
                          ) : (
                            <Link href={`/tenants/${g.tenantId}`} className="text-xs text-indigo-600 font-semibold hover:underline">View →</Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Breakdown (expanded) */}
                    {isMulti && isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 divide-y divide-slate-100 dark:divide-slate-800">
                        {g.items.map(item => {
                          const itemBalance = item.amountDue - item.amountPaid;
                          const itemColor   = STATUS_COLOR[item.status] ?? "text-slate-600 bg-slate-50 border-slate-200";
                          return (
                            <div key={`${item.type}-${item.id}`} className="px-5 py-2.5 flex items-start gap-3">
                              <span className="text-slate-300 dark:text-slate-600 text-sm shrink-0 mt-0.5">↳</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{item.label}</p>
                                {item.type === "payment" && item.breakdown && (
                                  <BreakdownLines breakdown={item.breakdown} fmt={fmt} />
                                )}
                              </div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0">{fmt(itemBalance)}</p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${itemColor}`}>
                                <span className={`w-1 h-1 rounded-full ${STATUS_DOT[item.status] ?? "bg-slate-400"}`} />
                                {item.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Paginator page={billPage} total={billGroups.length} pageSize={BILL_PAGE_SIZE} onChange={setBillPage} />
          </div>
        )}

        {/* All caught up */}
        {billGroups.length === 0 && visibleSessions.length > 0 && (
          <div className="px-5 py-4 flex items-center gap-2.5 bg-emerald-50/40 dark:bg-emerald-500/10">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {tenant ? `${tenant} has no outstanding bills` : "No outstanding bills"} ✓
            </p>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawer && (
        <SessionDrawer
          key={drawer.key}
          session={drawer}
          fmt={fmt}
          isPro={isPro}
          canVoid={drawer.key === mostRecentKey}
          onClose={() => setDrawer(null)}
          onVoided={() => router.refresh()}
        />
      )}
    </div>
  );
}
