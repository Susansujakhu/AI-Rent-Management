"use client";

import { useForm } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Receipt, ArrowLeft } from "lucide-react";

type FormData = { title: string; amount: number; date: string; notes: string };

const field = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white";
const label = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const err   = "text-rose-500 text-xs mt-1.5";

export default function NewOneTimeChargePage() {
  const router = useRouter();
  const { id: tenantId } = useParams<{ id: string }>();
  const today = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ defaultValues: { date: today } });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/one-time-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tenantId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Charge added");
      router.push(`/tenants/${tenantId}`);
    } catch {
      toast.error("Failed to add charge");
    }
  };

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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-sm shadow-orange-200">
          <Receipt size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add One-time Charge</h1>
          <p className="text-sm text-slate-500">Bill the tenant for an extra expense</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div>
          <label className={label}>Description <span className="text-rose-500 normal-case">*</span></label>
          <input
            {...register("title", { required: "Description is required" })}
            placeholder="e.g. Water bill, Key replacement, Late fee"
            className={field}
          />
          {errors.title && <p className={err}>{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Amount <span className="text-rose-500 normal-case">*</span></label>
            <input
              type="number"
              step="0.01"
              {...register("amount", {
                required: "Amount is required",
                min: { value: 1, message: "Must be at least 1" },
              })}
              placeholder="500"
              className={field}
            />
            {errors.amount && <p className={err}>{errors.amount.message}</p>}
          </div>
          <div>
            <label className={label}>Date <span className="text-rose-500 normal-case">*</span></label>
            <input
              type="date"
              {...register("date", { required: "Date is required" })}
              className={field}
            />
            {errors.date && <p className={err}>{errors.date.message}</p>}
          </div>
        </div>

        <div>
          <label className={label}>Notes</label>
          <textarea
            {...register("notes")}
            rows={3}
            placeholder="Optional notes or reason for this charge..."
            className={`${field} resize-none`}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-orange-500 to-rose-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-rose-600 disabled:opacity-50 transition-all shadow-sm shadow-orange-200"
          >
            {isSubmitting ? "Adding..." : "Add Charge"}
          </button>
          <Link
            href={`/tenants/${tenantId}`}
            className="flex-1 text-center border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
