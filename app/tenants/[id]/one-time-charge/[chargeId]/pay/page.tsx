"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { PAYMENT_METHODS } from "@/lib/utils";
import { CreditCard, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Charge = {
  id: string; title: string; amount: number; amountPaid: number;
  status: string; date: string; notes: string | null;
  tenant: { name: string };
};
type FormData = { amountPaid: number; method: string; notes: string };

function fmt(n: number, symbol: string) {
  return `${symbol}${new Intl.NumberFormat("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`;
}

export default function PayOneTimeChargePage() {
  const router = useRouter();
  const { id: tenantId, chargeId } = useParams<{ id: string; chargeId: string }>();
  const [charge, setCharge]               = useState<Charge | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("रू");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ defaultValues: { method: "CASH" } });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: Record<string, string>) => setCurrencySymbol(s["currency_symbol"] ?? "रू"));

    fetch(`/api/one-time-charges/${chargeId}`)
      .then((r) => r.json())
      .then((data: Charge) => {
        setCharge(data);
        reset({ amountPaid: data.amount - data.amountPaid, method: "CASH" });
      });
  }, [chargeId, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch(`/api/one-time-charges/${chargeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("Payment recorded");
      router.push(`/tenants/${tenantId}`);
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const fieldCls = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  if (!charge) {
    return (
      <div className="max-w-lg space-y-4 animate-pulse">
        <div className="h-6 bg-slate-100 rounded-xl w-32" />
        <div className="h-7 bg-slate-100 rounded-xl w-56" />
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3.5 bg-slate-100 rounded-lg w-24" />
              <div className="h-3.5 bg-slate-100 rounded-lg w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const balance = charge.amount - charge.amountPaid;

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      {/* Back link */}
      <Link
        href={`/tenants/${tenantId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        <ArrowLeft size={14} /> Back to tenant
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-200">
          <CreditCard size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pay One-time Charge</h1>
          <p className="text-sm text-slate-500 truncate max-w-xs">{charge.title}</p>
        </div>
      </div>

      {/* Charge summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
            {charge.tenant.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{charge.tenant.name}</p>
            <p className="text-xs text-slate-400">{charge.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400 font-medium mb-1">Total</p>
            <p className="font-bold text-slate-900">{fmt(charge.amount, currencySymbol)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400 font-medium mb-1">Paid</p>
            <p className="font-bold text-emerald-600">{fmt(charge.amountPaid, currencySymbol)}</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-3 text-center">
            <p className="text-xs text-rose-400 font-medium mb-1">Balance</p>
            <p className="font-bold text-rose-600">{fmt(balance, currencySymbol)}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div>
          <label className={labelCls}>Amount Paid ({currencySymbol}) <span className="text-rose-500 normal-case">*</span></label>
          <input
            type="number"
            step="0.01"
            {...register("amountPaid", {
              required: "Amount is required",
              min: { value: 0.01, message: "Must be greater than 0" },
              max: { value: balance, message: `Cannot exceed balance (${fmt(balance, currencySymbol)})` },
            })}
            className={fieldCls}
          />
          {errors.amountPaid && <p className="text-rose-500 text-xs mt-1.5">{errors.amountPaid.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Payment Method</label>
          <select {...register("method")} className={`${fieldCls}`}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            placeholder="Optional notes..."
            className={`${fieldCls} resize-none`}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 transition-all shadow-sm shadow-emerald-200"
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
