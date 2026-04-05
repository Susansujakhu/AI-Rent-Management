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
    return <div className="flex items-center justify-center h-48"><p className="text-gray-400 text-sm">Loading...</p></div>;
  }

  const balance  = payment.amountDue - payment.amountPaid;
  const totalOutstanding = allUnpaid.reduce((s, u) => s + (u.amountDue - u.amountPaid), 0)
    + unpaidCharges.reduce((s, c) => s + (c.amount - c.amountPaid), 0);
  const entered  = Number(watchedAmount) || 0;
  const coverage = entered > 0 ? buildCoveragePreview(entered, allUnpaid, unpaidCharges, !!applyToOneTime) : [];
  const showPreview = coverage.length > 1 || (coverage.length === 1 && (coverage[0].kind === "charge" || coverage[0].label !== formatMonth(payment.month)));

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      PAID: "bg-green-100 text-green-800", PARTIAL: "bg-blue-100 text-blue-800",
      PENDING: "bg-yellow-100 text-yellow-800", OVERDUE: "bg-red-100 text-red-800",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>
        <p className="text-sm text-gray-500 mt-1">{formatMonth(payment.month)}</p>
      </div>

      {/* Payment Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-gray-500">Tenant</p><p className="font-semibold text-gray-900">{payment.tenant.name}</p></div>
          <div><p className="text-gray-500">Room</p><p className="font-semibold text-gray-900">{payment.room.name}</p></div>
          <div><p className="text-gray-500">Amount Due</p><p className="font-semibold text-gray-900">{formatCurrency(payment.amountDue, currencySymbol)}</p></div>
          <div><p className="text-gray-500">Already Paid</p><p className="font-semibold text-gray-900">{formatCurrency(payment.amountPaid, currencySymbol)}</p></div>
          <div><p className="text-gray-500">Balance (this month)</p><p className="font-semibold text-red-600">{formatCurrency(balance, currencySymbol)}</p></div>
          <div><p className="text-gray-500">Status</p><StatusBadge status={payment.status} /></div>
          {totalOutstanding > balance && (
            <div className="col-span-2 pt-1 border-t border-gray-100">
              <p className="text-gray-500">Total Outstanding (all months)</p>
              <p className="font-semibold text-red-700 text-base">{formatCurrency(totalOutstanding, currencySymbol)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount Paid ({currencySymbol}) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            {...register("amountPaid", {
              required: "Amount is required",
              min: { value: 0.01, message: "Amount must be greater than 0" },
            })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.amountPaid && (
            <p className="text-red-500 text-xs mt-1">{errors.amountPaid.message}</p>
          )}

          {/* Distribution preview */}
          {showPreview && (
            <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800 space-y-1">
              <p className="font-medium">This payment will cover:</p>
              {coverage.map((item, i) => (
                <div key={i} className="flex justify-between items-start">
                  <span className={item.kind === "charge" ? "text-orange-700" : ""}>
                    {item.kind === "charge" ? `📋 ${item.label}` : item.label}
                  </span>
                  <span className="text-right">
                    {item.full
                      ? "Full payment"
                      : <>{`Partial — ${formatCurrency(item.amount, currencySymbol)}`}<br /><span className="text-red-400">Remaining: {formatCurrency(item.remainingAfter, currencySymbol)}</span></>
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {unpaidCharges.length > 0 && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              {...register("applyToOneTimeCharges")}
              className="accent-blue-600 w-4 h-4"
            />
            <span className="text-sm text-gray-700">
              Also apply to one-time charges
              <span className="ml-1 text-xs text-gray-400">
                ({unpaidCharges.length} unpaid, {formatCurrency(unpaidCharges.reduce((s, c) => s + (c.amount - c.amountPaid), 0), currencySymbol)} due)
              </span>
            </span>
          </label>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
          <select
            {...register("method")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            {...register("paidDate", { required: "Date is required" })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.paidDate && <p className="text-red-500 text-xs mt-1">{errors.paidDate.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Optional notes"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Recording..." : "Record Payment"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
