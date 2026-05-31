"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { History, Loader2, X, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { formatCurrency, formatDate, formatRentalPeriod } from "@/lib/utils";
import { VoidPaymentButton } from "./void-payment-button";
import { SendReminderButton } from "./send-reminder-button";
import { ResendNotificationButton } from "./resend-notification-button";
import { BreakdownLines, type BreakdownData } from "@/components/breakdown-lines";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SerializedPayment {
  id: string; month: string; amountDue: number; amountPaid: number;
  paidDate: string | null; method: string | null; status: string; notes: string | null;
  breakdown?: BreakdownData;
  // Extra (one-time) charges dated within this payment's calendar month.
  // Folded into the row's displayed Due/Paid/Balance so electricity, repairs,
  // etc. appear in the same row rather than being orphaned from rent.
  extraDue?:  number;
  extraPaid?: number;
}

interface Transaction {
  id: string; type: "payment" | "charge"; label: string | null;
  amount: number; creditAmount: number;
  method: string | null; paidAt: string; note: string | null;
}

interface Props {
  payments:       SerializedPayment[];
  currencySymbol: string;
  isPro:          boolean;
  tenantPhone:    string | null;
  whatsappNotify: boolean;
  moveInDay:      number;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID:    "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20",
    PARTIAL: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
    PENDING: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20",
    OVERDUE: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20",
  };
  const dots: Record<string, string> = {
    PAID: "bg-emerald-500", PARTIAL: "bg-blue-500", PENDING: "bg-amber-400", OVERDUE: "bg-rose-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? "bg-slate-400"}`} />
      {status}
    </span>
  );
}

// ── Balance cell ──────────────────────────────────────────────────────────────

function BalanceCell({ amountDue, amountPaid, status, fmt }: {
  amountDue: number; amountPaid: number; status: string; fmt: (n: number) => string;
}) {
  const balance = Math.max(0, amountDue - amountPaid);
  if (status === "PAID") {
    return <span className="text-emerald-500 font-semibold text-xs">—</span>;
  }
  const color = status === "OVERDUE"
    ? "text-rose-600 font-bold"
    : status === "PARTIAL"
    ? "text-amber-600 font-bold"
    : "text-slate-500 font-semibold";
  return <span className={color}>{fmt(balance)}</span>;
}

// ── Paginator ─────────────────────────────────────────────────────────────────

function Paginator({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  // Show at most 5 page buttons
  const pages: number[] = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60">
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
              p === page ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-200"
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

function TxnTotal({ txns, fmt }: { txns: Transaction[]; fmt: (n: number) => string }) {
  const totalPaid   = txns.reduce((s, t) => s + t.amount, 0);
  const totalCredit = txns.reduce((s, t) => s + (t.creditAmount ?? 0), 0);
  return (
    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total paid</span>
      <div className="text-right">
        <span className="text-base font-black text-slate-900 dark:text-white">{fmt(totalPaid + totalCredit)}</span>
        {totalCredit > 0 && (
          <p className="text-[11px] text-slate-400 mt-0.5">{fmt(totalPaid)} rent · {fmt(totalCredit)} credit</p>
        )}
      </div>
    </div>
  );
}

// ── Transaction history floating popover ──────────────────────────────────────

function TransactionHistory({ paymentId, fmt }: { paymentId: string; fmt: (n: number) => string }) {
  const [open,    setOpen]    = useState(false);
  const [txns,    setTxns]    = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [pos,     setPos]     = useState<{ top: number; right?: number; left?: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape or outside click
  useEffect(() => {
    if (!open) return;
    const onKey   = (e: KeyboardEvent)   => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown",  onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown",  onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const toggle = async () => {
    if (open) { setOpen(false); return; }

    // Position: below the button on mobile (full-width sheet), to the left
    // of the button on desktop (matches old behaviour).
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      if (window.innerWidth < 640) {
        setPos({ top: r.bottom + window.scrollY + 6, left: 8, right: 8 });
      } else {
        setPos({
          top:   r.top + window.scrollY,
          right: window.innerWidth - r.right + r.width + 8,
        });
      }
    }
    if (!fetched) {
      setLoading(true);
      const r = await fetch(`/api/payments/${paymentId}/transactions`);
      if (r.ok) setTxns(await r.json() as Transaction[]);
      setLoading(false);
      setFetched(true);
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
          open ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        }`}
        title="Payment history"
      >
        <History className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">History</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="absolute z-50 w-auto sm:w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ top: pos.top, right: pos.right, left: pos.left }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-500/10 dark:to-slate-800 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Payment History</span>
            </div>
            <button onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Loading…
            </div>
          ) : txns.length === 0 ? (
            <p className="px-4 py-5 text-xs text-slate-400 italic text-center">No transactions recorded.</p>
          ) : (
            <>
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {txns.map(t => (
                  <div key={t.id} className={`px-4 py-3 flex items-start gap-3 ${t.type === "charge" ? "bg-violet-50/40 dark:bg-violet-500/10" : ""}`}>
                    <div className="shrink-0 mt-0.5">
                      {t.type === "charge"
                        ? <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full leading-none">charge</span>
                        : <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full leading-none">rent</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={t.label ?? "rent"}>
                        {t.label ?? "rent"}
                      </p>
                      {t.note && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5" title={t.note}>{t.note}</p>
                      )}
                      {t.method && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{t.method}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{fmt(t.amount)}</p>
                      {t.creditAmount > 0 && (
                        <p className="text-[11px] text-emerald-600 font-medium mt-0.5">+{fmt(t.creditAmount)} credit</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <TxnTotal txns={txns} fmt={fmt} />
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

// Compute the row's displayed numbers, folding in extra (one-time) charges
// that fall in the same month so electricity, repairs, etc. show in the
// matching rent row instead of being orphaned.
function combine(p: SerializedPayment) {
  const due  = p.amountDue  + (p.extraDue  ?? 0);
  const paid = p.amountPaid + (p.extraPaid ?? 0);
  const balance = Math.max(0, due - paid);
  let status = p.status;
  if (due > 0 && paid >= due)      status = "PAID";
  else if (paid > 0)               status = "PARTIAL";
  return { due, paid, balance, status };
}

export function PaymentLedger({ payments, currencySymbol, isPro, tenantPhone, whatsappNotify, moveInDay }: Props) {
  const fmt    = (n: number) => formatCurrency(n, currencySymbol);
  const fmtMon = (month: string) => formatRentalPeriod(month, moveInDay);
  const [page, setPage] = useState(1);

  if (payments.length === 0) {
    return <div className="p-10 text-center text-slate-400 text-sm">No payment records yet.</div>;
  }

  // Summary totals (across ALL months, not just the current page).
  const totalDue       = payments.reduce((s, p) => s + combine(p).due, 0);
  const totalPaid      = payments.reduce((s, p) => s + combine(p).paid, 0);
  const totalBalance   = payments.reduce((s, p) => s + combine(p).balance, 0);
  const hasOutstanding = totalBalance > 0;

  // Paginated slice
  const paged = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {/* ── Mobile ─────────────────────────────────────────────────────────── */}
      <div className="divide-y divide-slate-50 dark:divide-slate-800 sm:hidden">
        {paged.map(p => {
          const c = combine(p);
          const balColor = c.balance > 0
            ? (c.status === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400")
            : "text-emerald-600 dark:text-emerald-400";
          return (
            <div key={p.id} className="p-4 space-y-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors">
              {/* Header: month + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-tight">{fmtMon(p.month)}</p>
                  {p.breakdown && (
                    <div className="mt-1">
                      <BreakdownLines breakdown={p.breakdown} fmt={fmt} />
                    </div>
                  )}
                </div>
                <StatusBadge status={c.status} />
              </div>

              {/* Amounts: 3-column grid for visual scan */}
              <div className="grid grid-cols-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 overflow-hidden">
                <div className="px-2 py-2 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">{fmt(c.due)}</p>
                </div>
                <div className="px-2 py-2 text-center border-x border-slate-200/70 dark:border-slate-700/60">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">{fmt(c.paid)}</p>
                </div>
                <div className="px-2 py-2 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance</p>
                  <p className={`text-sm font-bold mt-0.5 tabular-nums ${balColor}`}>{c.balance > 0 ? fmt(c.balance) : "—"}</p>
                </div>
              </div>

              {/* Progress bar for partial payments */}
              {c.status === "PARTIAL" && c.due > 0 && (
                <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (c.paid / c.due) * 100)}%` }}
                  />
                </div>
              )}

              {/* Primary action row: Add Payment + Notify when not yet PAID */}
              {c.status !== "PAID" && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Link href={`/payments/${p.id}/pay`}
                    className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap">
                    + Add Payment
                  </Link>
                  <SendReminderButton
                    paymentId={p.id} paymentStatus={c.status}
                    hasPhone={!!tenantPhone} whatsappNotify={whatsappNotify} isPro={isPro}
                  />
                </div>
              )}

              {/* Receipt meta + secondary icons on a single row — when the
                  bill is PAID this becomes the only action row, so the date/
                  method sit inline with Receipt / WA / History instead of
                  hogging their own line. */}
              {(p.paidDate || p.amountPaid > 0) && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-slate-400 truncate">
                    {p.paidDate ? `${formatDate(p.paidDate)}${p.method ? ` · ${p.method}` : ""}` : ""}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.amountPaid > 0 && (
                      <Link href={`/payments/${p.id}/receipt`}
                        title="Receipt"
                        className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 px-2 py-1.5 rounded-lg transition-colors">
                        <Receipt size={14} />
                      </Link>
                    )}
                    {p.amountPaid > 0 && (
                      <ResendNotificationButton
                        paymentId={p.id}
                        hasPhone={!!tenantPhone} whatsappNotify={whatsappNotify} isPro={isPro}
                      />
                    )}
                    {p.amountPaid > 0 && <TransactionHistory paymentId={p.id} fmt={fmt} />}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Mobile summary */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs font-semibold border-t border-slate-100 dark:border-slate-700">
          <span className="text-slate-500">Total ({payments.length} months)</span>
          <div className="flex items-center gap-4">
            <span className="text-slate-500">Due <span className="text-slate-800 dark:text-slate-300">{fmt(totalDue)}</span></span>
            <span className="text-slate-500">Paid <span className="text-slate-900 dark:text-white">{fmt(totalPaid)}</span></span>
            {hasOutstanding && <span className="text-rose-600">Bal {fmt(totalBalance)}</span>}
          </div>
        </div>
        <Paginator page={page} total={payments.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* ── Desktop ────────────────────────────────────────────────────────── */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50/80 to-slate-50/40 dark:from-slate-800/80 dark:to-slate-800/40">
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Month</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Balance</th>
              <th className="text-center px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Date · Method</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {paged.map(p => {
              const c = combine(p);
              return (
              <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors group align-top">
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{fmtMon(p.month)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <span className="font-bold text-slate-900 dark:text-white">{fmt(c.paid)}</span>
                  <span className="block text-[11px] text-slate-400">of {fmt(c.due)}</span>
                  {p.breakdown && (
                    <div className="flex justify-end">
                      <BreakdownLines breakdown={p.breakdown} fmt={fmt} />
                    </div>
                  )}
                  {c.status === "PARTIAL" && c.due > 0 && (
                    <div className="mt-1 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full"
                        style={{ width: `${Math.min(100, (c.paid / c.due) * 100)}%` }} />
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <BalanceCell amountDue={c.due} amountPaid={c.paid} status={c.status} fmt={fmt} />
                </td>
                <td className="px-3 py-3 text-center"><StatusBadge status={c.status} /></td>
                <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">
                  {p.paidDate ? (
                    <>
                      <span className="tabular-nums">{formatDate(p.paidDate)}</span>
                      {p.method && <span className="block text-slate-300 mt-0.5">{p.method}</span>}
                    </>
                  ) : "—"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {c.status !== "PAID" && (
                        <>
                          <Link href={`/payments/${p.id}/pay`}
                            className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors font-medium whitespace-nowrap">
                            Add Payment
                          </Link>
                          <SendReminderButton
                            paymentId={p.id} paymentStatus={c.status}
                            hasPhone={!!tenantPhone} whatsappNotify={whatsappNotify} isPro={isPro}
                          />
                        </>
                      )}
                      {p.amountPaid > 0 && (
                        <Link href={`/payments/${p.id}/receipt`}
                          className="text-xs text-slate-400 hover:text-indigo-600 transition-colors font-medium">
                          Receipt
                        </Link>
                      )}
                      {p.amountPaid > 0 && (
                        <ResendNotificationButton
                          paymentId={p.id}
                          hasPhone={!!tenantPhone} whatsappNotify={whatsappNotify} isPro={isPro}
                        />
                      )}
                      {p.amountPaid > 0 && p.status !== "PAID" && (
                        <VoidPaymentButton paymentId={p.id} />
                      )}
                    </div>
                    {p.amountPaid > 0 && <TransactionHistory paymentId={p.id} fmt={fmt} />}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>

          {/* Summary footer */}
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60">
              <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                Total <span className="font-normal text-slate-400">({payments.length} months)</span>
              </td>
              <td className="px-3 py-3 text-right text-sm font-bold text-slate-900 dark:text-white">{fmt(totalPaid)}</td>
              <td className="px-3 py-3 text-right text-sm">
                {hasOutstanding
                  ? <span className="font-bold text-rose-600">{fmt(totalBalance)}</span>
                  : <span className="font-semibold text-emerald-600">—</span>
                }
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
        <Paginator page={page} total={payments.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </>
  );
}
