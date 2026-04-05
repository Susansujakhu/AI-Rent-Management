"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { CheckSquare, Square, CreditCard, Search, X } from "lucide-react";

type Payment = {
  id: string;
  tenantId: string;
  roomId: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  method: string | null;
  paidDate: string | null;
  tenant: { id: string; name: string };
  room: { id: string; name: string };
};

const STATUS_STYLES: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-100",
  PARTIAL: "bg-blue-50 text-blue-700 border border-blue-200 ring-1 ring-blue-100",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200 ring-1 ring-amber-100",
  OVERDUE: "bg-rose-50 text-rose-700 border border-rose-200 ring-1 ring-rose-100",
};

const STATUS_DOT: Record<string, string> = {
  PAID:    "bg-emerald-500",
  PARTIAL: "bg-blue-500",
  PENDING: "bg-amber-400",
  OVERDUE: "bg-rose-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-slate-400"}`} />
      {status}
    </span>
  );
}

function TenantAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-orange-100 text-orange-700",
    "bg-rose-100 text-rose-700",
    "bg-indigo-100 text-indigo-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
}

export function PaymentsTable({ payments, currencySymbol }: { payments: Payment[]; currencySymbol: string }) {
  const fmt = (n: number) => formatCurrency(n, currencySymbol);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const unpaidIds = payments.filter(p => p.status !== "PAID").map(p => p.id);
  const filtered = search.trim()
    ? payments.filter(p =>
        p.tenant.name.toLowerCase().includes(search.toLowerCase()) ||
        p.room.name.toLowerCase().includes(search.toLowerCase())
      )
    : payments;

  const toggleAll = () => {
    const selectableInView = filtered.filter(p => p.status !== "PAID").map(p => p.id);
    const allSelected = selectableInView.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      selectableInView.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggle = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const markPaid = () => {
    if (!selected.size) return;
    startTransition(async () => {
      const res = await fetch("/api/payments/bulk-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIds: [...selected], method: "CASH" }),
      });
      if (!res.ok) { toast.error("Failed to mark payments"); return; }
      const { count } = await res.json() as { count: number };
      toast.success(`${count} payment${count !== 1 ? "s" : ""} marked as paid`);
      setSelected(new Set());
      window.location.reload();
    });
  };

  const selectableInView = filtered.filter(p => p.status !== "PAID");
  const allViewSelected = selectableInView.length > 0 && selectableInView.every(p => selected.has(p.id));

  return (
    <div className="relative">
      {/* Sticky bulk-action bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 mx-0 bg-indigo-600 text-white px-5 py-3 flex items-center justify-between shadow-lg shadow-indigo-200/60">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{selected.size} payment{selected.size !== 1 ? "s" : ""} selected</span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-indigo-200 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <button
            onClick={markPaid}
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-white text-indigo-700 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-50 disabled:opacity-60 transition-colors shadow-sm"
          >
            <CreditCard size={13} />
            {isPending ? "Processing…" : `Mark ${selected.size} Paid`}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tenant or room…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50/60 placeholder:text-slate-400 transition-all"
          />
        </div>
        {unpaidIds.length > 0 && selected.size === 0 && (
          <span className="text-xs text-slate-400 hidden sm:block">Select rows to bulk-pay</span>
        )}
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-slate-50 sm:hidden">
        {filtered.map(p => {
          const isSelected = selected.has(p.id);
          const paidPct = p.amountDue > 0 ? Math.round((p.amountPaid / p.amountDue) * 100) : 0;
          return (
            <div
              key={p.id}
              className={`p-4 transition-colors ${isSelected ? "bg-indigo-50/60" : "bg-white"}`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox or avatar */}
                <div className="flex flex-col items-center gap-2 pt-0.5">
                  {p.status !== "PAID" ? (
                    <button
                      onClick={() => toggle(p.id)}
                      className="text-slate-300 hover:text-indigo-600 transition-colors"
                    >
                      {isSelected
                        ? <CheckSquare size={18} className="text-indigo-600" />
                        : <Square size={18} />
                      }
                    </button>
                  ) : (
                    <TenantAvatar name={p.tenant.name} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <Link href={`/tenants/${p.tenantId}`} className="font-bold text-slate-900 hover:text-indigo-600 transition-colors truncate">
                      {p.tenant.name}
                    </Link>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="flex items-center justify-between text-sm mb-2">
                    <Link href={`/rooms/${p.roomId}`} className="text-slate-400 hover:text-indigo-500 transition-colors text-xs font-medium">
                      {p.room.name}
                    </Link>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{fmt(p.amountPaid)}</span>
                      <span className="text-slate-400 text-xs"> / {fmt(p.amountDue)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {p.status !== "PAID" && p.amountDue > 0 && (
                    <div className="w-full bg-slate-100 rounded-full h-1 mb-2">
                      <div
                        className={`h-1 rounded-full transition-all ${p.status === "PARTIAL" ? "bg-blue-400" : "bg-slate-300"}`}
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    {p.paidDate
                      ? <p className="text-xs text-slate-400">{fmtDate(p.paidDate)}</p>
                      : <span />
                    }
                    {p.status !== "PAID" && (
                      <Link
                        href={`/payments/${p.id}/pay`}
                        className="inline-flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        <CreditCard size={11} />
                        Pay
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-10 text-center text-slate-400 text-sm">No payments match your search.</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-slate-50/40">
              <th className="px-4 py-3.5 w-10">
                {unpaidIds.length > 0 && (
                  <button onClick={toggleAll} className="text-slate-300 hover:text-indigo-600 transition-colors">
                    {allViewSelected ? <CheckSquare size={15} className="text-indigo-600" /> : <Square size={15} />}
                  </button>
                )}
              </th>
              <th className="text-left px-3 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant</th>
              <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Room</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Due</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid</th>
              <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="text-center px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3.5 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(p => (
              <tr
                key={p.id}
                className={`group transition-colors ${
                  selected.has(p.id)
                    ? "bg-indigo-50/60 hover:bg-indigo-50/80"
                    : "hover:bg-slate-50/70"
                }`}
              >
                <td className="px-4 py-4 w-10">
                  {p.status !== "PAID" && (
                    <button onClick={() => toggle(p.id)} className="text-slate-300 hover:text-indigo-600 transition-colors">
                      {selected.has(p.id) ? <CheckSquare size={15} className="text-indigo-600" /> : <Square size={15} />}
                    </button>
                  )}
                </td>
                <td className="px-3 py-4">
                  <div className="flex items-center gap-2.5">
                    <TenantAvatar name={p.tenant.name} />
                    <Link href={`/tenants/${p.tenantId}`} className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                      {p.tenant.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Link href={`/rooms/${p.roomId}`} className="text-slate-500 hover:text-indigo-600 transition-colors text-sm">
                    {p.room.name}
                  </Link>
                </td>
                <td className="px-4 py-4 text-right font-medium text-slate-500">{fmt(p.amountDue)}</td>
                <td className="px-4 py-4 text-right font-bold text-slate-900">{fmt(p.amountPaid)}</td>
                <td className="px-4 py-4 text-right text-xs text-slate-400 tabular-nums">{fmtDate(p.paidDate)}</td>
                <td className="px-4 py-4 text-center"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-4 text-right">
                  {p.status !== "PAID" && (
                    <Link
                      href={`/payments/${p.id}/pay`}
                      className="inline-flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-semibold transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <CreditCard size={11} />
                      Pay
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-10 text-center text-slate-400 text-sm">No payments match your search.</div>
        )}
      </div>
    </div>
  );
}
