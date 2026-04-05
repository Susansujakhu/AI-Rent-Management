"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { PAYMENT_METHODS } from "@/lib/utils";

type Payment = {
  id: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  method: string | null;
  paidDate: string | null;
  notes: string | null;
  tenant: { id: string; name: string; phone: string };
  room: { name: string };
};

type UnpaidMonth = {
  id: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  status: string;
};

type UnpaidCharge = {
  id: string;
  title: string;
  amount: number;
  amountPaid: number;
};

type FormData = {
  amountPaid: number;
  method: string;
  paidDate: string;
  notes: string;
  applyToOneTimeCharges: boolean;
};

function formatCurrency(amount: number, symbol: string) {
  return `${symbol}${new Intl.NumberFormat("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;
}

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString("en", { month: "long", year: "numeric" });
}

// Distributes the entered amount across ALL unpaid months oldest-first
type PreviewItem =
  | { kind: "payment"; label: string; amount: number; full: boolean; remainingAfter: number }
  | { kind: "charge";  label: string; amount: number; full: boolean; remainingAfter: number };

function buildCoveragePreview(
  entered: number,
  allUnpaid: UnpaidMonth[],
  unpaidCharges: UnpaidCharge[],
  applyToOneTime: boolean,
): PreviewItem[] {
  const preview: PreviewItem[] = [];
  let remaining = entered;

  // When checkbox is checked: clear one-time charges first, then rent months
  if (applyToOneTime) {
    for (const c of unpaidCharges) {
      if (remaining <= 0) break;
      const bal = c.amount - c.amountPaid;
      if (bal <= 0) continue;
      const apply = Math.min(remaining, bal);
      preview.push({ kind: "charge", label: c.title, amount: apply, full: apply >= bal, remainingAfter: bal - apply });
      remaining -= apply;
    }
  }

  for (const u of allUnpaid) {
    if (remaining <= 0) break;
    const bal = u.amountDue - u.amountPaid;
    if (bal <= 0) continue;
    const apply = Math.min(remaining, bal);
    preview.push({ kind: "payment", label: formatMonth(u.month), amount: apply, full: apply >= bal, remainingAfter: bal - apply });
    remaining -= apply;
  }

  return preview;
}

export default function PayPage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const id      = params.id;

  const [payment,        setPayment]        = useState<Payment | null>(null);
  const [allUnpaid,      setAllUnpaid]      = useState<UnpaidMonth[]>([]);
  const [unpaidCharges,  setUnpaidCharges]  = useState<UnpaidCharge[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState("रू");

  const today = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } =
    useForm<FormData>({ defaultValues: { method: "CASH", paidDate: today } });

  const watchedAmount   = useWatch({ control, name: "amountPaid" });
  const applyToOneTime  = useWatch({ control, name: "applyToOneTimeCharges" });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: Record<string, string>) => setCurrencySymbol(s["currency_symbol"] ?? "रू"));

    fetch(`/api/payments/${id}`)
      .then((r) => r.json())
      .then((data: Payment) => {
        setPayment(data);

        // Fetch unpaid months and charges in parallel, then pre-fill with exact total
        Promise.all([
          fetch(`/api/payments?tenantId=${data.tenant.id}&status=unpaid`).then((r) => r.json()),
          fetch(`/api/one-time-charges?tenantId=${data.tenant.id}&status=unpaid`).then((r) => r.json()),
        ]).then(([unpaidRows, chargeRows]: [UnpaidMonth[], UnpaidCharge[]]) => {
          setAllUnpaid(unpaidRows ?? []);
          setUnpaidCharges(chargeRows ?? []);

          // Use exact (unrounded) sum so no stray remainder spills to next month
          const exactRentBalance   = (unpaidRows  ?? []).reduce((s, u) => s + (u.amountDue  - u.amountPaid), 0);
          const exactChargeBalance = (chargeRows  ?? []).reduce((s, c) => s + (c.amount     - c.amountPaid), 0);
          const exactTotal = exactRentBalance + exactChargeBalance;

          reset({
            amountPaid: exactTotal > 0 ? exactTotal : data.amountDue - data.amountPaid,
            method:    data.method ?? "CASH",
            paidDate:  today,
            notes:     data.notes  ?? "",
          });
        });
      });
  }, [id, reset, today]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("Payment recorded successfully");
      router.back();
    } catch {
      toast.error("Failed to record payment");
    }
  };

  if (!payment) {
    return (
      <div className="max-w-lg space-y-6 animate-pulse">
        <div className="h-7 bg-slate-100 rounded-xl w-44" />
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-3.5 bg-slate-100 rounded-lg w-28" />
              <div className="h-4 bg-slate-100 rounded-lg w-20" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <div className="h-10 bg-slate-100 rounded-xl" />
          <div className="h-10 bg-slate-100 rounded-xl" />
          <div className="h-10 bg-slate-100 rounded-xl" />
          <div className="h-10 bg-slate-100 rounded-xl" />
          <div className="h-10 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const balance  = payment.amountDue - payment.amountPaid;
  const totalOutstanding = allUnpaid.reduce((s, u) => s + (u.amountDue - u.amountPaid), 0)
    + unpaidCharges.reduce((s, c) => s + (c.amount - c.amountPaid), 0);
  const entered  = Number(watchedAmount) || 0;
  const coverage = entered > 0 ? buildCoveragePreview(entered, allUnpaid, unpaidCharges, !!applyToOneTime) : [];
  const showPreview = coverage.length > 1 || (coverage.length === 1 && (coverage[0].kind === "charge" || coverage[0].label !== formatMonth(payment.month)));

  const STATUS_STYLES: Record<string, string> = {
    PAID:    "bg-emerald-50 text-emerald-700 border border-emerald-100",
    PARTIAL: "bg-blue-50 text-blue-700 border border-blue-100",
    PENDING: "bg-amber-50 text-amber-700 border border-amber-100",
    OVERDUE: "bg-rose-50 text-rose-700 border border-rose-100",
  };

  const fieldClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow";
  const labelClass = "block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide";

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Record Payment</h1>
        <p className="text-sm text-slate-500 mt-0.5">{formatMonth(payment.month)}</p>
      </div>

      {/* Payment Info Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
            {payment.tenant.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{payment.tenant.name}</p>
            <p className="text-xs text-slate-400">{payment.room.name} · {formatMonth(payment.month)}</p>
          </div>
          <span className={`ml-auto inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLES[payment.status] ?? "bg-slate-100 text-slate-600"}`}>
            {payment.status}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-medium">Amount Due</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(payment.amountDue, currencySymbol)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-medium">Already Paid</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(payment.amountPaid, currencySymbol)}</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-3">
            <p className="text-xs text-rose-400 font-medium">Balance (this month)</p>
            <p className="font-bold text-rose-600 mt-0.5">{formatCurrency(balance, currencySymbol)}</p>
          </div>
          {totalOutstanding > balance && (
            <div className="bg-rose-50 rounded-xl p-3">
              <p className="text-xs text-rose-400 font-medium">Total Outstanding</p>
              <p className="font-bold text-rose-700 mt-0.5">{formatCurrency(totalOutstanding, currencySymbol)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div>
          <label className={labelClass}>
            Amount Paid ({currencySymbol}) <span className="text-rose-500 normal-case">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            {...register("amountPaid", {
              required: "Amount is required",
              min: { value: 0.01, message: "Amount must be greater than 0" },
            })}
            className={fieldClass}
          />
          {errors.amountPaid && (
            <p className="text-rose-500 text-xs mt-1.5">{errors.amountPaid.message}</p>
          )}

          {/* Distribution preview */}
          {showPreview && (
            <div className="mt-3 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs space-y-2">
              <p className="font-semibold text-indigo-800">This payment will cover:</p>
              {coverage.map((item, i) => (
                <div key={i} className="flex justify-between items-start gap-2">
                  <span className={`font-medium ${item.kind === "charge" ? "text-orange-700" : "text-indigo-700"}`}>
                    {item.kind === "charge" ? `📋 ${item.label}` : item.label}
                  </span>
                  <span className="text-right shrink-0">
                    {item.full
                      ? <span className="text-emerald-600 font-semibold">Full payment</span>
                      : <><span className="text-indigo-700">Partial — {formatCurrency(item.amount, currencySymbol)}</span><br /><span className="text-rose-400">Remaining: {formatCurrency(item.remainingAfter, currencySymbol)}</span></>
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {unpaidCharges.length > 0 && (
          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors select-none">
            <input
              type="checkbox"
              {...register("applyToOneTimeCharges")}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            <span className="text-sm text-slate-700 font-medium">
              Also apply to one-time charges
              <span className="ml-1.5 text-xs font-normal text-slate-400">
                ({unpaidCharges.length} unpaid · {formatCurrency(unpaidCharges.reduce((s, c) => s + (c.amount - c.amountPaid), 0), currencySymbol)} due)
              </span>
            </span>
          </label>
        )}

        <div>
          <label className={labelClass}>Payment Method</label>
          <select {...register("method")} className={`${fieldClass} bg-white`}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Payment Date <span className="text-rose-500 normal-case">*</span>
          </label>
          <input
            type="date"
            {...register("paidDate", { required: "Date is required" })}
            className={fieldClass}
          />
          {errors.paidDate && <p className="text-rose-500 text-xs mt-1.5">{errors.paidDate.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            className={`${fieldClass} resize-none`}
            placeholder="Optional notes"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200"
          >
            {isSubmitting ? "Recording..." : "Record Payment"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
