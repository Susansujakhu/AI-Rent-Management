"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatRentalPeriod } from "@/lib/utils";
import {
  Search, X, MessageCircle, Receipt, ExternalLink,
  History, Loader2, CreditCard, ChevronDown, Users,
} from "lucide-react";
import { createPortal } from "react-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentRow = {
  rowType:        "payment";
  id:             string;
  tenantId:       string;
  tenantName:     string;
  roomId:         string;
  roomName:       string;
  month:          string;
  moveInDay:      number;
  amountDue:      number;
  amountPaid:     number;
  paidDate:       string | null;
  method:         string | null;
  status:         string;
  tenantPhone:    string | null;
  whatsappNotify: boolean;
};

export type ChargeRow = {
  rowType:    "charge";
  id:         string;
  tenantId:   string;
  tenantName: string;
  title:      string;
  date:       string;
  amountDue:  number;
  amountPaid: number;
  status:     string;
};

export type AnyRow = PaymentRow | ChargeRow;

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
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status] ?? "bg-slate-400"}`} />
      {status}
    </span>
  );
}

function TenantAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = [
    "bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700", "bg-orange-100 text-orange-700",
    "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700",
  ];
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${colors[name.charCodeAt(0) % colors.length]}`}>
      {initials}
    </div>
  );
}

// ── Transaction type ──────────────────────────────────────────────────────────

type Transaction = {
  id: string; amount: number; creditAmount: number;
  method: string | null; paidAt: string; note: string | null;
};

// ── Payment detail drawer ─────────────────────────────────────────────────────

function PaymentDetailDrawer({
  row, fmt, isPro, onClose,
}: {
  row: PaymentRow;
  fmt: (n: number) => string;
  isPro: boolean;
  onClose: () => void;
}) {
  const [txns,    setTxns]    = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/payments/${row.id}/transactions`)
      .then(r => r.ok ? r.json() as Promise<Transaction[]> : [])
      .then(setTxns).catch(() => setTxns([]))
      .finally(() => setLoading(false));
  }, [row.id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const canSendReceipt = isPro && !!row.tenantPhone && row.whatsappNotify && row.amountPaid > 0;
  const balance = Math.max(0, row.amountDue - row.amountPaid);
  const period  = formatRentalPeriod(row.month, row.moveInDay);

  const sendReceipt = async () => {
    setSending(true);
    try {
      const res  = await fetch(`/api/payments/${row.id}/notify`, { method: "POST" });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) toast.error(data.error ?? "Failed to send");
      else toast.success("Payment receipt sent via WhatsApp ✅");
    } catch { toast.error("Failed to send"); }
    finally { setSending(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <TenantAvatar name={row.tenantName} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 truncate">{row.tenantName}</p>
            <p className="text-xs text-slate-400">{row.roomName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 border-b border-slate-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-700">{period}</p>
              <StatusBadge status={row.status} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Due",     val: fmt(row.amountDue),  cls: "text-slate-700" },
                { label: "Paid",    val: fmt(row.amountPaid), cls: "text-slate-900" },
                { label: "Balance", val: balance > 0 ? fmt(balance) : "—",
                  cls: balance > 0 ? (row.status === "OVERDUE" ? "text-rose-600" : "text-amber-600") : "text-emerald-500" },
              ].map(({ label, val, cls }) => (
                <div key={label} className="text-center">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-sm font-bold ${cls}`}>{val}</p>
                </div>
              ))}
            </div>
            {row.paidDate && (
              <p className="mt-2 text-xs text-slate-400 text-center">
                Paid {formatDate(row.paidDate)}{row.method ? ` · ${row.method}` : ""}
              </p>
            )}
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <History size={13} className="text-slate-400" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment History</p>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> Loading…</div>
            ) : txns.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {txns.map(t => (
                  <div key={t.id} className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-800">{fmt(t.amount)}</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">{formatDate(t.paidAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      {t.method && <span className="font-medium text-slate-500">{t.method}</span>}
                      {t.creditAmount > 0 && <span className="text-emerald-600 font-semibold">+{fmt(t.creditAmount)} credit</span>}
                    </div>
                    {t.note && <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={t.note}>{t.note}</p>}
                  </div>
                ))}
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
          {row.status !== "PAID" && (
            <Link href={`/payments/${row.id}/pay`}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
              <CreditCard size={14} />
              Record Payment
            </Link>
          )}
          <div className="flex gap-2">
            {row.amountPaid > 0 && (
              <Link href={`/payments/${row.id}/receipt`}
                className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors">
                <Receipt size={12} />Receipt
              </Link>
            )}
            <Link href={`/tenants/${row.tenantId}`}
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

// ── Main component ────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "",        label: "All statuses" },
  { value: "PAID",    label: "Paid"    },
  { value: "PARTIAL", label: "Partial" },
  { value: "PENDING", label: "Pending" },
  { value: "OVERDUE", label: "Overdue" },
];

export function AllPaymentsTable({
  rows,
  currencySymbol,
  isPro,
}: {
  rows:           AnyRow[];
  currencySymbol: string;
  isPro:          boolean;
}) {
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  // Unique sorted tenant names
  const tenantNames = Array.from(new Set(rows.map(r => r.tenantName))).sort();

  const [tenantFilter, setTenantFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail,       setDetail]       = useState<PaymentRow | null>(null);

  const filtered = rows.filter(r => {
    const matchTenant = !tenantFilter || r.tenantName === tenantFilter;
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchTenant && matchStatus;
  });

  // Totals for filtered set
  const totalPaid    = filtered.reduce((s, r) => s + r.amountPaid, 0);
  const totalDue     = filtered.reduce((s, r) => s + r.amountDue, 0);
  const totalBalance = Math.max(0, totalDue - totalPaid);

  const showTenantCol = !tenantFilter;

  return (
    <div>
      {/* ── Tenant picker ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 px-5 py-5 border-b border-slate-100">
        <div className="relative">
          <div className="flex items-center gap-2 bg-slate-100/80 rounded-full p-1">
            {/* Clear button */}
            {tenantFilter && (
              <button
                onClick={() => setTenantFilter("")}
                className="flex items-center justify-center w-7 h-7 rounded-full text-slate-500 hover:bg-white hover:text-slate-700 transition-all"
                title="Show all tenants"
              >
                <X size={13} />
              </button>
            )}

            {/* Dropdown styled as pill */}
            <div className="relative flex items-center">
              <Users size={13} className="absolute left-3 text-slate-400 pointer-events-none z-10" />
              <select
                value={tenantFilter}
                onChange={e => setTenantFilter(e.target.value)}
                className="appearance-none pl-8 pr-8 py-1.5 rounded-full bg-white shadow-sm text-sm font-semibold text-slate-800 border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer min-w-[200px]"
              >
                <option value="">All Tenants</option>
                {tenantNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-filters + summary ─────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                statusFilter === f.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search within filtered tenant */}
        {tenantFilter && (
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              placeholder="Search…"
              className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 w-36"
            />
          </div>
        )}

        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          {totalPaid > 0 && <> · <span className="font-semibold text-emerald-600">{fmt(totalPaid)} paid</span></>}
          {totalBalance > 0 && <> · <span className="font-semibold text-rose-500">{fmt(totalBalance)} outstanding</span></>}
        </span>
      </div>

      {/* ── Desktop table ─────────────────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-slate-50/40">
              {showTenantCol && (
                <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant</th>
              )}
              <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Period / Charge</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Due</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid Date</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Method</th>
              <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3.5 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(r => (
              <tr
                key={`${r.rowType}-${r.id}`}
                onClick={() => r.rowType === "payment" ? setDetail(r) : undefined}
                className={`group transition-colors ${r.rowType === "payment" ? "cursor-pointer hover:bg-slate-50/70" : "hover:bg-slate-50/40"}`}
              >
                {showTenantCol && (
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <TenantAvatar name={r.tenantName} />
                      <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{r.tenantName}</span>
                    </div>
                  </td>
                )}

                <td className="px-5 py-3.5">
                  {r.rowType === "payment" ? (
                    <span className="text-slate-700 font-medium">{formatRentalPeriod(r.month, r.moveInDay)}</span>
                  ) : (
                    <div>
                      <span className="text-slate-700 font-medium">{r.title}</span>
                      <span className="ml-2 text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded uppercase tracking-wide">Charge</span>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(r.date)}</p>
                    </div>
                  )}
                </td>

                <td className="px-4 py-3.5 text-right text-slate-500 font-medium">{fmt(r.amountDue)}</td>

                <td className="px-4 py-3.5 text-right">
                  <span className={`font-bold ${r.amountPaid > 0 ? "text-slate-900" : "text-slate-300"}`}>
                    {r.amountPaid > 0 ? fmt(r.amountPaid) : "—"}
                  </span>
                </td>

                <td className="px-4 py-3.5 text-right text-xs text-slate-400 tabular-nums whitespace-nowrap">
                  {"paidDate" in r ? (r.paidDate ? formatDate(r.paidDate) : "—") : "—"}
                </td>

                <td className="px-4 py-3.5 text-xs text-slate-400">
                  {"method" in r ? (r.method ?? "—") : "—"}
                </td>

                <td className="px-4 py-3.5 text-center"><StatusBadge status={r.status} /></td>

                <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {r.rowType === "payment" && r.status !== "PAID" && (
                      <Link href={`/payments/${r.id}/pay`}
                        className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 font-semibold transition-colors whitespace-nowrap">
                        Add Payment
                      </Link>
                    )}
                    {r.rowType === "charge" && r.status !== "PAID" && (
                      <Link href={`/tenants/${r.tenantId}`}
                        className="text-xs text-indigo-600 font-semibold hover:underline">
                        View →
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-14 text-center text-slate-400 text-sm">No records match your filters.</div>
        )}
      </div>

      {/* ── Mobile cards ─────────────────────────────────────────────────── */}
      <div className="divide-y divide-slate-50 sm:hidden">
        {filtered.map(r => (
          <div
            key={`${r.rowType}-${r.id}`}
            onClick={() => r.rowType === "payment" ? setDetail(r) : undefined}
            className="p-4 hover:bg-slate-50/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {showTenantCol && <TenantAvatar name={r.tenantName} />}
                <div className="min-w-0">
                  {showTenantCol && <p className="font-bold text-slate-900 truncate text-sm">{r.tenantName}</p>}
                  <p className="text-xs text-slate-600 font-medium">
                    {r.rowType === "payment"
                      ? formatRentalPeriod(r.month, r.moveInDay)
                      : <>{r.title} <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1 py-0.5 rounded uppercase">Charge</span></>
                    }
                  </p>
                </div>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className={`flex items-center gap-3 text-xs text-slate-400 ${showTenantCol ? "ml-9" : ""}`}>
              {r.amountPaid > 0 && <span className="font-semibold text-slate-700">{fmt(r.amountPaid)} paid</span>}
              {"paidDate" in r && r.paidDate && <span>{formatDate(r.paidDate)}</span>}
              {"method" in r && r.method && <span>{r.method}</span>}
              {r.amountPaid < r.amountDue && (
                <span>Bal <span className="font-semibold text-amber-600">{fmt(r.amountDue - r.amountPaid)}</span></span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-10 text-center text-slate-400 text-sm">No records match your filters.</div>
        )}
      </div>

      {/* Detail drawer */}
      {detail && (
        <PaymentDetailDrawer
          key={detail.id}
          row={detail}
          fmt={fmt}
          isPro={isPro}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
