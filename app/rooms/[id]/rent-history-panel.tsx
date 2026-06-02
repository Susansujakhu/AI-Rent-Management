"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingUp, Plus, X } from "lucide-react";

export interface RentHistoryRow {
  id:            string;
  amount:        number;
  effectiveFrom: string;             // YYYY-MM
  reason:        string | null;
  createdAt:     string;             // ISO
}

function formatMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1).toLocaleDateString("en", { month: "short", year: "numeric" });
}

// "2026-06" with moveInDay 7 → "June/July 2026" so the user sees which
// fiscal month the new rate applies to. moveInDay <= 1 collapses to a single
// month name since the rent period IS the calendar month.
function formatPeriod(m: string, moveInDay: number): string {
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const [y, mo] = m.split("-").map(Number);
  const idx = mo - 1;
  if (!moveInDay || moveInDay <= 1) return `${MONTHS[idx]} ${y}`;
  const nextIdx  = (idx + 1) % 12;
  const nextYear = idx === 11 ? y + 1 : y;
  return idx === 11
    ? `${MONTHS[idx]} ${y}/${MONTHS[nextIdx]} ${nextYear}`
    : `${MONTHS[idx]}/${MONTHS[nextIdx]} ${nextYear}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const nextY = mo === 12 ? y + 1 : y;
  const nextM = mo === 12 ? 1     : mo + 1;
  return `${nextY}-${String(nextM).padStart(2, "0")}`;
}

export function RentHistoryPanel({
  roomId,
  currencySymbol,
  history,
  currentRent,
  moveInDay,
}: {
  roomId:         string;
  currencySymbol: string;
  history:        RentHistoryRow[];  // newest first (effectiveFrom desc)
  currentRent:    number;
  moveInDay:      number;            // for rent-period labels — fall back to 1 if no tenant
}) {
  const router = useRouter();
  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString()}`;

  // Default effective-from = the month after the latest history row (or this month if no history)
  const defaultEffectiveFrom = history[0]
    ? nextMonth(history[0].effectiveFrom)
    : new Date().toISOString().slice(0, 7);

  const [open,           setOpen]           = useState(false);
  const [mounted,        setMounted]        = useState(false);
  const [amount,         setAmount]         = useState("");
  const [effectiveFrom,  setEffectiveFrom]  = useState(defaultEffectiveFrom);
  const [reason,         setReason]         = useState("");
  const [applyToUnpaid,  setApplyToUnpaid]  = useState(true);
  const [submitting,     setSubmitting]     = useState(false);
  const [err,            setErr]            = useState("");

  // Portal target lives on document.body so the modal escapes the parent
  // page's transformed wrapper (animate-fade-up creates a containing block
  // that would otherwise trap `position: fixed` inside the main area).
  useEffect(() => { setMounted(true); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) { setErr("Enter a valid rent amount"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/rent-increment`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount: num, effectiveFrom, reason: reason.trim() || undefined, applyToUnpaid }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; recomputed?: number };
      if (!res.ok) { setErr(data.error ?? "Failed to apply increment"); return; }
      toast.success(
        data.recomputed
          ? `Rent updated. ${data.recomputed} unpaid bill${data.recomputed === 1 ? "" : "s"} adjusted.`
          : "Rent updated",
      );
      setOpen(false);
      setAmount("");
      setReason("");
      router.refresh();
    } catch {
      setErr("Failed to apply increment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current rent + action */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Rent</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">{fmt(currentRent)}<span className="text-sm font-medium text-slate-400">/mo</span></p>
          {history[0] && (
            <p className="text-xs text-slate-400 mt-0.5">since {formatPeriod(history[0].effectiveFrom, moveInDay)}</p>
          )}
        </div>
        <button
          onClick={() => { setOpen(true); setEffectiveFrom(defaultEffectiveFrom); }}
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <TrendingUp size={14} />
          Increase rent
        </button>
      </div>

      {/* History list */}
      {history.length > 0 && (
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50/60 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">History · {history.length} {history.length === 1 ? "entry" : "entries"}</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {history.map((h, idx) => {
              const next = history[idx - 1];                            // newer row (since sorted desc)
              const rangeEnd = next ? `until ${formatPeriod(next.effectiveFrom, moveInDay)}` : "(current)";
              return (
                <div key={h.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {fmt(h.amount)}<span className="text-xs font-normal text-slate-400">/mo</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatPeriod(h.effectiveFrom, moveInDay)} {rangeEnd}
                    </p>
                    {h.reason && <p className="text-xs text-slate-400 mt-1 italic">{h.reason}</p>}
                  </div>
                  {idx === 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full shrink-0">CURRENT</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal — portalled to document.body so it escapes the page's
          transformed wrapper and the overlay covers the whole viewport. */}
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80"
             onClick={() => !submitting && setOpen(false)}>
          <form
            onSubmit={submit}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            {/* Indigo gradient header — matches the receipt-drawer pattern */}
            <div className="relative bg-gradient-to-br from-indigo-600 to-indigo-700 px-5 py-4 text-white">
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="absolute top-3 right-3 text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-indigo-200" />
                <h3 className="text-base font-bold">Update Rent</h3>
              </div>
              <p className="text-xs text-indigo-200">Past PAID and PARTIAL bills are never changed — your history stays intact.</p>
            </div>

            {/* Current → new preview */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current</p>
                <p className="text-base font-bold text-slate-700 dark:text-slate-200 mt-0.5 tabular-nums">{fmt(currentRent)}</p>
              </div>
              <span className="text-slate-300 dark:text-slate-600 text-lg">→</span>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New</p>
                <p className={`text-base font-bold mt-0.5 tabular-nums ${amount && Number(amount) > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-300 dark:text-slate-600"}`}>
                  {amount && Number(amount) > 0 ? fmt(Number(amount)) : "—"}
                </p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">New rent</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">{currencySymbol}</span>
                  <input
                    type="number" min={1} step="any" required autoFocus
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={String(currentRent)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Effective from</label>
                <input
                  type="month" required
                  value={effectiveFrom}
                  min={history[0] ? nextMonth(history[0].effectiveFrom) : undefined}
                  onChange={e => setEffectiveFrom(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Billing period: <span className="font-semibold">{formatPeriod(effectiveFrom, moveInDay)}</span>
                  {history[0] && <span className="text-slate-400"> · must be after {formatPeriod(history[0].effectiveFrom, moveInDay)}</span>}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Reason <span className="text-slate-400 font-normal normal-case">— optional</span></label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Annual review, market rate"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/5 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                <input
                  type="checkbox"
                  checked={applyToUnpaid}
                  onChange={e => setApplyToUnpaid(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4 rounded mt-0.5"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Apply to unpaid bills from {formatPeriod(effectiveFrom, moveInDay)} onward</span>
                  <br />
                  <span className="text-slate-500 dark:text-slate-400">Only bills with no money received are affected. PARTIAL/PAID bills are never changed.</span>
                </span>
              </label>

              {err && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                  {err}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} disabled={submitting}
                  className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-200">
                  <Plus size={14} />
                  {submitting ? "Saving…" : "Save change"}
                </button>
              </div>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
