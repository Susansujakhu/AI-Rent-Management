"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, CheckCircle2, Clock } from "lucide-react";

export interface OutstandingBill {
  id:        string;
  label:     string;   // e.g. "Apr 7 – May 7, 2026"
  balance:   number;   // amountDue - amountPaid
}

const METHODS = ["eSewa", "Khalti", "FonePay", "Bank", "Cash", "Other"] as const;

/**
 * Tenant-facing "I've paid — notify owner" reporter. Submits a PaymentClaim
 * (a claim, NOT a recorded payment). The owner is notified to verify and
 * record it. `reportedPaymentIds` are bills that already have a pending claim
 * so we can disable double-reporting.
 */
export function ReportPayment({
  token,
  bills,
  reportedPaymentIds,
  currencySymbol,
}: {
  token:              string;
  bills:              OutstandingBill[];
  reportedPaymentIds: string[];
  currencySymbol:     string;
}) {
  const router = useRouter();
  const [open, setOpen]             = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const reported = new Set(reportedPaymentIds);
  const selectableBills = bills.filter(b => !reported.has(b.id));

  const [paymentId, setPaymentId] = useState<string>(selectableBills[0]?.id ?? "");
  const [amount,    setAmount]    = useState<string>(selectableBills[0] ? String(Math.round(selectableBills[0].balance)) : "");
  const [method,    setMethod]    = useState<string>("eSewa");
  const [paidDate,  setPaidDate]  = useState<string>(today);
  const [reference, setReference] = useState("");
  const [note,      setNote]      = useState("");

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString("en-IN")}`;

  const onPickBill = (id: string) => {
    setPaymentId(id);
    const b = bills.find(x => x.id === id);
    if (b) setAmount(String(Math.round(b.balance)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a valid amount"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/payment-claims", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-portal-token": token },
        body:    JSON.stringify({
          paymentId: paymentId || undefined,
          amount:    amt,
          method,
          reference: reference.trim() || undefined,
          paidDate,
          note:      note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Couldn't send. Try again."); return; }
      setDone(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setOpen(false); setDone(false); setError("");
    setReference(""); setNote(""); setPaidDate(today); setMethod("eSewa");
  };

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden">
      <div className="px-4 py-3.5 border-b border-indigo-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send size={15} className="text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800">Paid outside the app?</h2>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-indigo-200"
          >
            Report payment
          </button>
        )}
      </div>

      {!open ? (
        <p className="px-4 py-3 text-xs text-slate-500 leading-relaxed">
          Paid via eSewa, bank, or cash? Tap <span className="font-semibold text-slate-700">Report payment</span> to
          let your owner know — they&apos;ll confirm it once the money arrives.
        </p>
      ) : done ? (
        <div className="px-4 py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={22} className="text-emerald-600" />
          </div>
          <p className="text-sm font-bold text-slate-800">Owner notified</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            Your payment report was sent. It&apos;ll show as confirmed once your owner verifies it.
          </p>
          <button onClick={reset} className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="px-4 py-4 space-y-3">
          {/* Note that this is a report, not a payment */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <Clock size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              This <span className="font-semibold">notifies your owner</span> — it doesn&apos;t confirm payment until they verify it.
            </p>
          </div>

          {selectableBills.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">For which bill?</label>
              <select
                value={paymentId}
                onChange={e => onPickBill(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {selectableBills.map(b => (
                  <option key={b.id} value={b.id}>{b.label} — {fmt(Math.round(b.balance))} due</option>
                ))}
                <option value="">Other / general payment</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Amount paid</label>
              <input
                type="number" inputMode="decimal" min="1" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Method</label>
              <select
                value={method} onChange={e => setMethod(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Date paid</label>
              <input
                type="date" value={paidDate} max={today} onChange={e => setPaidDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Reference <span className="font-normal normal-case text-slate-300">opt.</span></label>
              <input
                type="text" value={reference} onChange={e => setReference(e.target.value)}
                placeholder="txn id"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Note <span className="font-normal normal-case text-slate-300">optional</span></label>
            <input
              type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Anything your owner should know"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit" disabled={submitting}
              className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            >
              <Send size={14} /> {submitting ? "Sending…" : "Notify owner"}
            </button>
            <button
              type="button" onClick={reset}
              className="px-4 border border-slate-200 text-slate-500 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center"
            >
              <X size={15} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
