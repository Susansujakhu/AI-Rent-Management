"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { PAYMENT_METHODS } from "@/lib/utils";

type Charge = {
  id: string; title: string; amount: number; amountPaid: number;
  status: string; date: string; notes: string | null;
  tenant: { name: string };
};
type FormData = { amountPaid: number; notes: string };

function formatAmount(n: number, symbol: string) {
  return `${symbol}${new Intl.NumberFormat("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`;
}

export default function PayOneTimeChargePage() {
  const router = useRouter();
  const { id: tenantId, chargeId } = useParams<{ id: string; chargeId: string }>();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("रू");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: Record<string, string>) => setCurrencySymbol(s["currency_symbol"] ?? "रू"));

    fetch(`/api/one-time-charges/${chargeId}`)
      .then((r) => r.json())
      .then((data: Charge) => {
        setCharge(data);
        reset({ amountPaid: data.amount - data.amountPaid });
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

  if (!charge) return <div className="flex items-center justify-center h-48"><p className="text-gray-400 text-sm">Loading...</p></div>;

  const balance = charge.amount - charge.amountPaid;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Pay One-time Charge</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm space-y-2">
        <div className="flex justify-between"><span className="text-gray-500">Tenant</span><span className="font-semibold">{charge.tenant.name}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Description</span><span className="font-semibold">{charge.title}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Total Amount</span><span className="font-semibold">{formatAmount(charge.amount, currencySymbol)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Already Paid</span><span className="font-semibold">{formatAmount(charge.amountPaid, currencySymbol)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Balance</span><span className="font-semibold text-red-600">{formatAmount(balance, currencySymbol)}</span></div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid ({currencySymbol}) <span className="text-red-500">*</span></label>
          <input
            type="number" step="0.01"
            {...register("amountPaid", {
              required: "Amount is required",
              min: { value: 0.01, message: "Must be greater than 0" },
              max: { value: balance, message: `Cannot exceed balance (${formatAmount(balance, currencySymbol)})` },
            })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.amountPaid && <p className="text-red-500 text-xs mt-1">{errors.amountPaid.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            {...register("notes")} rows={2} placeholder="Optional notes"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isSubmitting}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
            {isSubmitting ? "Recording..." : "Record Payment"}
          </button>
          <button type="button" onClick={() => router.back()}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
