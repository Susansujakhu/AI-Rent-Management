"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, CheckCircle2, Clock, ImagePlus } from "lucide-react";

export interface OutstandingBill {
  id:      string;
  label:   string;   // e.g. "Apr 7 – May 7, 2026"
  balance: number;   // amountDue - amountPaid
}

const METHODS = ["eSewa", "Khalti", "FonePay", "Bank", "Cash", "Other"] as const;

const FIELD =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 " +
  "placeholder:text-slate-400 [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-indigo-300";

type CoverageLine =
  | { kind: "bill";   label: string; full: boolean; applied: number; remainingAfter: number }
  | { kind: "credit"; amount: number };

// Distribute the entered amount across outstanding bills oldest-first — mirrors
// the owner's record-payment cascade so the tenant sees exactly what will happen.
function buildCoverage(entered: number, billsOldestFirst: OutstandingBill[]): CoverageLine[] {
  const lines: CoverageLine[] = [];
  let remaining = entered;
  for (const b of billsOldestFirst) {
    if (remaining <= 0) break;
    const apply = Math.min(remaining, b.balance);
    lines.push({
      kind: "bill",
      label: b.label,
      full: apply >= b.balance - 0.001,
      applied: apply,
      remainingAfter: Math.max(0, b.balance - apply),
    });
    remaining -= apply;
  }
  if (remaining > 0.001) lines.push({ kind: "credit", amount: remaining });
  return lines;
}

/**
 * Tenant-facing "I've paid — notify owner" reporter. Amount-first: the tenant
 * enters what they paid and sees how it cascades across their unpaid months
 * (oldest first), plus any advance credit. Optional proof-of-payment
 * screenshot. Submits a PaymentClaim (a claim, NOT a recorded payment).
 */
export function ReportPayment({
  token,
  bills,
  hasPendingClaim,
  currencySymbol,
}: {
  token:           string;
  bills:           OutstandingBill[];   // outstanding, any order — sorted oldest-first below
  hasPendingClaim: boolean;
  currencySymbol:  string;
}) {
  const router = useRouter();
  const [open, setOpen]             = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const totalOutstanding = bills.reduce((s, b) => s + b.balance, 0);
  const [amount,    setAmount]    = useState<string>(totalOutstanding > 0 ? String(Math.round(totalOutstanding)) : "");
  const [method,    setMethod]    = useState<string>("eSewa");
  const [paidDate,  setPaidDate]  = useState<string>(today);
  const [reference, setReference] = useState("");
  const [note,      setNote]      = useState("");
  const [file,      setFile]      = useState<File | null>(null);

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString("en-IN")}`;

  const entered  = Number(amount) || 0;
  const coverage = entered > 0 ? buildCoverage(entered, bills) : [];
  const oldestUnpaidId = bills[0]?.id ?? "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!Number.isFinite(entered) || entered <= 0) { setError("Enter a valid amount"); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("amount",    String(entered));
      fd.set("method",    method);
      fd.set("paidDate",  paidDate);
      if (reference.trim()) fd.set("reference", reference.trim());
      if (note.trim())      fd.set("note", note.trim());
      if (oldestUnpaidId)   fd.set("oldestUnpaidId", oldestUnpaidId);
      if (file)             fd.set("screenshot", file);

      const res = await fetch("/api/portal/payment-claims", {
        method:  "POST",
        headers: { "x-portal-token": token },   // NOTE: no Content-Type — browser sets multipart boundary
        body:    fd,
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
    setReference(""); setNote(""); setFile(null); setPaidDate(today); setMethod("eSewa");
  };

  // Already reported and awaiting confirmation — show a quiet status instead.
  if (hasPendingClaim && !done) {
    return (
      <div className="bg-white rounded-2xl border border-indigo-100 px-4 py-3.5 flex items-center gap-2.5">
        <Clock size={15} className="text-indigo-500 shrink-0" />
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Payment reported.</span>{" "}
          It&apos;s awaiting your owner&apos;s confirmation.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden">
      <div className="px-4 py-3.5 border-b border-indigo-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send size={15} className="text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800">Paid outside the app?</h2>
        </div>
        {!open && !done && (
          <button
            onClick={() => setOpen(true)}
            className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-indigo-200"
          >
            Report payment
          </button>
        )}
      </div>

      {done ? (
        <div className="px-4 py-6 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={22} className="text-emerald-600" />
          </div>
          <p className="text-sm font-bold text-slate-800">Owner notified</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            Your payment report was sent. It&apos;ll show as confirmed once your owner verifies it.
          </p>
        </div>
      ) : !open ? (
        <p className="px-4 py-3 text-xs text-slate-500 leading-relaxed">
          Paid via eSewa, bank, or cash? Tap <span className="font-semibold text-slate-700">Report payment</span> to
          let your owner know — they&apos;ll confirm it once the money arrives.
        </p>
      ) : (
        <form onSubmit={submit} className="px-4 py-4 space-y-3">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <Clock size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              This <span className="font-semibold">notifies your owner</span> — it doesn&apos;t confirm payment until they verify it.
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Amount paid</label>
            <input
              type="number" inputMode="decimal" min="1" step="0.01"
              value={amount} onChange={e => setAmount(e.target.value)}
              className={`${FIELD} text-base font-bold`} placeholder="0"
            />
          </div>

          {/* Breakdown preview */}
          {coverage.length > 0 && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-[11px] space-y-1.5">
              <p className="font-bold text-indigo-700">This will go toward:</p>
              {coverage.map((c, i) =>
                c.kind === "credit" ? (
                  <div key={i} className="flex justify-between pt-1.5 border-t border-indigo-200/60">
                    <span className="text-teal-700 font-semibold">💰 Advance credit</span>
                    <span className="text-teal-700 font-bold">+{fmt(Math.round(c.amount))}</span>
                  </div>
                ) : (
                  <div key={i} className="flex justify-between">
                    <span className="text-indigo-700 font-medium">{c.label}</span>
                    {c.full
                      ? <span className="text-emerald-600 font-bold">Full</span>
                      : <span className="text-amber-600 font-semibold">Partial — {fmt(Math.round(c.applied))}</span>}
                  </div>
                )
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Method</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className={FIELD}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Date paid</label>
              <input type="date" value={paidDate} max={today} onChange={e => setPaidDate(e.target.value)} className={FIELD} />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
              Reference <span className="font-normal normal-case text-slate-300">optional</span>
            </label>
            <input
              type="text" value={reference} onChange={e => setReference(e.target.value)}
              placeholder="Transaction ID" className={FIELD}
            />
          </div>

          {/* Screenshot */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
              Screenshot <span className="font-normal normal-case text-slate-300">optional</span>
            </label>
            <label className="flex items-center gap-2.5 border border-dashed border-slate-300 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
              <ImagePlus size={16} className="text-indigo-500 shrink-0" />
              <span className="text-sm text-slate-600 truncate">
                {file ? file.name : "Attach payment proof (image)"}
              </span>
              <input
                type="file" accept="image/*" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <button
                  type="button"
                  onClick={(ev) => { ev.preventDefault(); setFile(null); }}
                  className="ml-auto text-slate-400 hover:text-rose-500 shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">
              Note <span className="font-normal normal-case text-slate-300">optional</span>
            </label>
            <input
              type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Anything your owner should know" className={FIELD}
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
