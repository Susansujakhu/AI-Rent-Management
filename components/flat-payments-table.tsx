"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatRentalPeriod } from "@/lib/utils";
import {
  Users, ChevronDown, X, MessageCircle, Receipt,
  ExternalLink, CreditCard, Bell,
} from "lucide-react";
import { createPortal } from "react-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FlatRow = {
  rowType:        "payment" | "charge";
  id:             string;
  tenantId:       string;
  tenantName:     string;
  // payment fields
  roomName?:      string;
  month?:         string;
  moveInDay?:     number;
  tenantPhone?:   string | null;
  whatsappNotify?: boolean;
  // charge fields
  title?:         string;
  date?:          string;
  // shared
  amountDue:      number;
  amountPaid:     number;
  totalReceived:  number;  // sum of transactions (incl. credit) — actual cash received
  paidDate:       string | null;
  method:         string | null;
  status:         string;
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
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status] ?? "bg-slate-400"}`} />
      {status}
    </span>
  );
}

function TenantAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-violet-100 text-violet-700","bg-blue-100 text-blue-700","bg-emerald-100 text-emerald-700","bg-orange-100 text-orange-700","bg-rose-100 text-rose-700","bg-indigo-100 text-indigo-700"];
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${colors[name.charCodeAt(0) % colors.length]}`}>
      {initials}
    </div>
  );
}

function rowLabel(r: FlatRow): string {
  if (r.rowType === "payment" && r.month && r.moveInDay) {
    return formatRentalPeriod(r.month, r.moveInDay);
  }
  return r.title ?? "—";
}

// ── Row detail drawer ─────────────────────────────────────────────────────────

function RowDetailDrawer({ row, fmt, isPro, onClose }: {
  row: FlatRow; fmt: (n: number) => string; isPro: boolean; onClose: () => void;
}) {
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const canSendReceipt =
    isPro && row.rowType === "payment" && !!row.tenantPhone && !!row.whatsappNotify && row.totalReceived > 0;

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

  const balance = Math.max(0, row.amountDue - row.amountPaid);

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <TenantAvatar name={row.tenantName} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 truncate">{row.tenantName}</p>
            <p className="text-xs text-slate-400">{row.roomName ?? ""}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* What it covers */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              {row.rowType === "payment" ? "Rent Period" : "Charge"}
            </p>
            <p className="text-base font-bold text-slate-800">{rowLabel(row)}</p>
            {row.rowType === "charge" && row.date && (
              <p className="text-xs text-slate-400 mt-0.5">{formatDate(row.date)}</p>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due</p>
              <p className="text-sm font-bold text-slate-700">{fmt(row.amountDue)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Received</p>
              <p className="text-sm font-bold text-slate-900">{row.totalReceived > 0 ? fmt(row.totalReceived) : "—"}</p>
            </div>
            {row.amountPaid !== row.totalReceived && row.totalReceived > 0 && (
              <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Applied</p>
                <p className="text-sm font-bold text-slate-700">{fmt(row.amountPaid)}</p>
              </div>
            )}
            {balance > 0 && (
              <div className={`rounded-xl px-3 py-2.5 ${row.status === "OVERDUE" ? "bg-rose-50" : "bg-amber-50"}`}>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Balance</p>
                <p className={`text-sm font-bold ${row.status === "OVERDUE" ? "text-rose-600" : "text-amber-600"}`}>{fmt(balance)}</p>
              </div>
            )}
          </div>

          {/* Paid date + method */}
          {row.paidDate && (
            <div className="text-xs text-slate-400">
              Paid on <span className="font-semibold text-slate-600">{formatDate(row.paidDate)}</span>
              {row.method && <> via <span className="font-semibold text-slate-600">{row.method}</span></>}
            </div>
          )}

          <div className="flex items-center"><StatusBadge status={row.status} /></div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 space-y-2">
          {canSendReceipt && (
            <button onClick={sendReceipt} disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
              <MessageCircle size={14} className={sending ? "animate-pulse" : ""} />
              {sending ? "Sending…" : "Send Receipt via WhatsApp"}
            </button>
          )}
          {row.status !== "PAID" && row.rowType === "payment" && (
            <Link href={`/payments/${row.id}/pay`}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
              <CreditCard size={14} />
              Record Payment
            </Link>
          )}
          <div className="flex gap-2">
            {row.totalReceived > 0 && row.rowType === "payment" && (
              <Link href={`/payments/${row.id}/receipt`}
                className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors">
                <Receipt size={12} />Receipt
              </Link>
            )}
            <Link href={`/tenants/${row.tenantId}`}
              className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors">
              <ExternalLink size={12} />Tenant
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "",        label: "All"     },
  { value: "PAID",    label: "Paid"    },
  { value: "PARTIAL", label: "Partial" },
  { value: "PENDING", label: "Pending" },
  { value: "OVERDUE", label: "Overdue" },
];

export function FlatPaymentsTable({
  rows,
  currencySymbol,
  isPro,
}: {
  rows:           FlatRow[];
  currencySymbol: string;
  isPro:          boolean;
}) {
  const fmt = (n: number) => formatCurrency(n, currencySymbol);

  const tenantNames = Array.from(new Set(rows.map(r => r.tenantName))).sort();

  const [tenantFilter, setTenantFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail,       setDetail]       = useState<FlatRow | null>(null);

  const filtered = rows.filter(r =>
    (!tenantFilter || r.tenantName === tenantFilter) &&
    (!statusFilter || r.status === statusFilter)
  );

  const showTenant = !tenantFilter;

  return (
    <div>
      {/* ── Tenant picker ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2 bg-slate-100/80 rounded-full p-1">
          {tenantFilter && (
            <button onClick={() => setTenantFilter("")}
              className="flex items-center justify-center w-7 h-7 rounded-full text-slate-500 hover:bg-white hover:text-slate-700 transition-all">
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

      {/* ── Status filters ─────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${statusFilter === f.value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} records</span>
      </div>

      {/* ── Desktop table ──────────────────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid Date</th>
              {showTenant && <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant</th>}
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Month / Charge</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount Paid</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Due</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Method</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(r => (
              <tr key={`${r.rowType}-${r.id}`} onClick={() => setDetail(r)}
                className="group cursor-pointer hover:bg-slate-50/70 transition-colors">

                {/* Paid Date */}
                <td className="px-5 py-3.5 whitespace-nowrap">
                  {r.paidDate
                    ? <span className="text-sm font-semibold text-slate-700">{formatDate(r.paidDate)}</span>
                    : <span className="text-slate-300 text-sm">—</span>
                  }
                </td>

                {/* Tenant */}
                {showTenant && (
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <TenantAvatar name={r.tenantName} />
                      <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{r.tenantName}</span>
                    </div>
                  </td>
                )}

                {/* Month / Charge */}
                <td className="px-4 py-3.5">
                  <span className="font-medium text-slate-700">{rowLabel(r)}</span>
                  {r.rowType === "charge" && (
                    <span className="ml-2 text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded uppercase tracking-wide">Charge</span>
                  )}
                </td>

                {/* Amount Paid */}
                <td className="px-4 py-3.5 text-right">
                  <span className={`font-black text-base ${r.totalReceived > 0 ? "text-slate-900" : "text-slate-300"}`}>
                    {r.totalReceived > 0 ? fmt(r.totalReceived) : "—"}
                  </span>
                </td>

                {/* Due */}
                <td className="px-4 py-3.5 text-right text-slate-400 font-medium">{fmt(r.amountDue)}</td>

                {/* Method */}
                <td className="px-4 py-3.5 text-xs text-slate-400">{r.method ?? "—"}</td>

                {/* Status */}
                <td className="px-4 py-3.5 text-center"><StatusBadge status={r.status} /></td>

                {/* Actions */}
                <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {r.rowType === "payment" && r.status !== "PAID" && (
                      <>
                        <Link href={`/payments/${r.id}/pay`}
                          className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 font-semibold transition-colors whitespace-nowrap">
                          Add Payment
                        </Link>
                        {r.tenantPhone && r.whatsappNotify && isPro && (
                          <button
                            onClick={async () => {
                              const res = await fetch("/api/whatsapp/send-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: r.id, type: r.status === "OVERDUE" ? "overdue" : "due" }) });
                              const d   = await res.json() as { error?: string };
                              if (!res.ok) toast.error(d.error ?? "Failed"); else toast.success("Reminder sent ✅");
                            }}
                            className="flex items-center gap-1 text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded-lg font-medium transition-colors"
                          >
                            <Bell size={11} />
                          </button>
                        )}
                      </>
                    )}
                    {r.rowType === "charge" && r.status !== "PAID" && (
                      <Link href={`/tenants/${r.tenantId}`} className="text-xs text-indigo-600 font-semibold hover:underline">View →</Link>
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

      {/* ── Mobile cards ──────────────────────────────────────────────────── */}
      <div className="divide-y divide-slate-50 sm:hidden">
        {filtered.map(r => (
          <div key={`${r.rowType}-${r.id}`} onClick={() => setDetail(r)}
            className="px-4 py-3.5 hover:bg-slate-50/60 transition-colors flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {showTenant && <TenantAvatar name={r.tenantName} />}
                <span className="font-semibold text-slate-800 text-sm truncate">
                  {showTenant ? r.tenantName : rowLabel(r)}
                </span>
                {r.rowType === "charge" && (
                  <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded uppercase shrink-0">Charge</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {showTenant && <span className="text-slate-500">{rowLabel(r)}</span>}
                {r.paidDate && <span>{formatDate(r.paidDate)}</span>}
                {r.method && <span>{r.method}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black text-sm ${r.totalReceived > 0 ? "text-slate-900" : "text-slate-300"}`}>
                {r.totalReceived > 0 ? fmt(r.totalReceived) : "—"}
              </p>
              <StatusBadge status={r.status} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-10 text-center text-slate-400 text-sm">No records match your filters.</div>
        )}
      </div>

      {/* Detail drawer */}
      {detail && (
        <RowDetailDrawer key={detail.id} row={detail} fmt={fmt} isPro={isPro} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
