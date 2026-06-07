"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PAYMENT_METHODS } from "@/lib/utils";
import { BreakdownLines, type BreakdownData } from "@/components/breakdown-lines";
import { buildCoveragePreview, formatMonth, type UnpaidMonth, type UnpaidCharge } from "@/lib/payment-distribution";

// Map a tenant-reported method (eSewa/Khalti/…) to the closest pay-form method.
function mapClaimMethod(m: string | null): string {
  switch ((m ?? "").toLowerCase()) {
    case "bank":   return "BANK";
    case "cash":   return "CASH";
    case "esewa":
    case "khalti":
    case "fonepay": return "E-WALLET";   // eSewa / Khalti / FonePay → e-wallet
    default:        return "CASH";
  }
}

type Payment = {
  id: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  method: string | null;
  paidDate: string | null;
  notes: string | null;
  tenant: { id: string; name: string; phone: string; creditBalance?: number };
  room: { name: string };
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

export default function PayPage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const search  = useSearchParams();
  const id      = params.id;

  // Prefill values when arriving from a tenant's payment report ("Verify & record").
  const claimAmount = search.get("claimAmount");
  const claimMethod = search.get("claimMethod");
  const claimDate   = search.get("claimDate");
  const claimRef    = search.get("claimRef");
  const claimNote   = search.get("claimNote");
  const fromClaim   = !!claimAmount;

  const [payment,        setPayment]        = useState<Payment | null>(null);
  const [allUnpaid,      setAllUnpaid]      = useState<UnpaidMonth[]>([]);
  const [unpaidCharges,  setUnpaidCharges]  = useState<UnpaidCharge[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState("रू");
  const [breakdown,      setBreakdown]      = useState<BreakdownData | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } =
    useForm<FormData>({ defaultValues: { method: "CASH", paidDate: today, applyToOneTimeCharges: true } });

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

        // Fetch unpaid months, charges, and breakdown in parallel
        Promise.all([
          fetch(`/api/payments?tenantId=${data.tenant.id}&status=unpaid`).then((r) => r.json()),
          fetch(`/api/one-time-charges?tenantId=${data.tenant.id}&status=unpaid`).then((r) => r.json()),
          fetch(`/api/payments/${id}/breakdown`).then((r) => r.ok ? r.json() : null),
        ]).then(([unpaidRows, chargeRows, breakdownData]: [UnpaidMonth[], UnpaidCharge[], BreakdownData | null]) => {
          if (breakdownData && breakdownData.charges.length > 0) setBreakdown(breakdownData);
          setAllUnpaid(unpaidRows ?? []);
          setUnpaidCharges(chargeRows ?? []);

          // Use exact (unrounded) sum so no stray remainder spills to next month
          const exactRentBalance   = (unpaidRows  ?? []).reduce((s, u) => s + (u.amountDue  - u.amountPaid), 0);
          const exactChargeBalance = (chargeRows  ?? []).reduce((s, c) => s + (c.amount     - c.amountPaid), 0);
          const exactTotal = exactRentBalance + exactChargeBalance;

          // When opened from a tenant's report, prefill with what they said
          // they paid. Stash the original method + reference into notes since
          // the pay form has no dedicated fields for them.
          if (fromClaim) {
            const reportedBits = [
              `Reported via ${claimMethod ?? "—"}`,
              claimRef  ? `ref: ${claimRef}`   : "",
              claimNote ? `note: ${claimNote}` : "",
            ].filter(Boolean).join(" · ");
            reset({
              amountPaid: Number(claimAmount) || (exactTotal > 0 ? exactTotal : data.amountDue - data.amountPaid),
              method:    mapClaimMethod(claimMethod),
              paidDate:  claimDate || today,
              notes:     reportedBits,
              applyToOneTimeCharges: true,
            });
          } else {
            reset({
              amountPaid: exactTotal > 0 ? exactTotal : data.amountDue - data.amountPaid,
              method:    data.method ?? "CASH",
              paidDate:  today,
              notes:     data.notes  ?? "",
              applyToOneTimeCharges: true,
            });
          }
        });
      });
  }, [id, reset, today, fromClaim, claimAmount, claimMethod, claimDate, claimRef, claimNote]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("Payment recorded successfully");
      router.push(`/tenants/${payment!.tenant.id}`);
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
  const coverage = entered > 0 ? buildCoveragePreview(entered, allUnpaid, unpaidCharges, !!applyToOneTime, id) : [];
  // Show the preview whenever it carries information beyond "you're paying this
  // month's bill" — extra months, one-time charges, OR a credit-balance bump.
  const showPreview = coverage.some(c =>
    c.kind === "charge" ||
    c.kind === "credit" ||
    (c.kind === "payment" && c.label !== formatMonth(payment.month))
  );

  const STATUS_STYLES: Record<string, string> = {
    PAID:    "bg-emerald-50 text-emerald-700 border border-emerald-100",
    PARTIAL: "bg-blue-50 text-blue-700 border border-blue-100",
    PENDING: "bg-amber-50 text-amber-700 border border-amber-100",
    OVERDUE: "bg-rose-50 text-rose-700 border border-rose-100",
  };

  const fieldClass = "w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white dark:bg-slate-800 dark:text-slate-200";
  const labelClass = "block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide";

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Record Payment</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{formatMonth(payment.month)}</p>
      </div>

      {/* Payment Info Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            {payment.tenant.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{payment.tenant.name}</p>
            <p className="text-xs text-slate-400">{payment.room.name} · {formatMonth(payment.month)}</p>
          </div>
          <span className={`ml-auto inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLES[payment.status] ?? "bg-slate-100 text-slate-600"}`}>
            {payment.status}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-medium">Amount Due</p>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(payment.amountDue, currencySymbol)}</p>
            {breakdown && (
              <BreakdownLines breakdown={breakdown} fmt={(n) => formatCurrency(n, currencySymbol)} />
            )}
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-medium">Already Paid</p>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(payment.amountPaid, currencySymbol)}</p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-500/10 rounded-xl p-3">
            <p className="text-xs text-rose-400 font-medium">Balance (this month)</p>
            <p className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">{formatCurrency(balance, currencySymbol)}</p>
          </div>
          {totalOutstanding > balance && (
            <div className="bg-rose-50 dark:bg-rose-500/10 rounded-xl p-3">
              <p className="text-xs text-rose-400 font-medium">Total Outstanding</p>
              <p className="font-bold text-rose-700 dark:text-rose-400 mt-0.5">{formatCurrency(totalOutstanding, currencySymbol)}</p>
            </div>
          )}
          {(payment.tenant.creditBalance ?? 0) > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
              <p className="text-xs text-emerald-500 font-medium">Advance Credit</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(payment.tenant.creditBalance!, currencySymbol)}</p>
              <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 mt-0.5">auto-applies to dues</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
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
            <div className="mt-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 px-4 py-3 text-xs space-y-2">
              <p className="font-semibold text-indigo-800 dark:text-indigo-300">This payment will cover:</p>
              {coverage.map((item, i) => {
                if (item.kind === "credit") {
                  return (
                    <div key={i} className="flex justify-between items-start gap-2 pt-2 border-t border-indigo-200/40 dark:border-indigo-500/20">
                      <span className="font-medium text-teal-700 dark:text-teal-400">💰 Advance credit</span>
                      <span className="text-teal-700 dark:text-teal-400 font-semibold text-right shrink-0">
                        +{formatCurrency(item.amount, currencySymbol)}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex justify-between items-start gap-2">
                    <span className={`font-medium ${item.kind === "charge" ? "text-orange-700 dark:text-orange-400" : "text-indigo-700 dark:text-indigo-300"}`}>
                      {item.kind === "charge" ? `📋 ${item.label}` : item.label}
                    </span>
                    <span className="text-right shrink-0">
                      {item.full
                        ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Full payment</span>
                        : <><span className="text-indigo-700 dark:text-indigo-300">Partial — {formatCurrency(item.amount, currencySymbol)}</span><br /><span className="text-rose-400">Remaining: {formatCurrency(item.remainingAfter, currencySymbol)}</span></>
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {unpaidCharges.length > 0 && (
          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors select-none">
            <input
              type="checkbox"
              {...register("applyToOneTimeCharges")}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
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
            className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
