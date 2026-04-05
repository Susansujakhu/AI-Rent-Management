"use client";

import { useForm } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

type FormData = { title: string; amount: number; date: string; notes: string };

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
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Add One-time Charge</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            {...register("title", { required: "Description is required" })}
            placeholder="e.g. Water bill, Key replacement, Late fee"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount (₹) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            {...register("amount", { required: "Amount is required", min: { value: 1, message: "Must be at least ₹1" } })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            {...register("date", { required: "Date is required" })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            {...register("notes")}
            rows={2}
            placeholder="Optional notes"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Adding..." : "Add Charge"}
          </button>
          <Link
            href={`/tenants/${tenantId}`}
            className="flex-1 text-center border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
