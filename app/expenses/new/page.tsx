"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/utils";

type Room = { id: string; name: string; floor: string | null };
type FormData = { title: string; amount: number; date: string; category: string; roomId: string; description: string };

const field = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white";
const label = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const err   = "text-rose-500 text-xs mt-1.5";

export default function NewExpensePage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const today = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { category: EXPENSE_CATEGORIES[0], date: today },
  });

  useEffect(() => { fetch("/api/rooms").then(r => r.json()).then(setRooms); }, []);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      toast.success("Expense added");
      router.push("/expenses");
    } catch { toast.error("Failed to add expense"); }
  };

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm shadow-orange-200">
          <Receipt size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Expense</h1>
          <p className="text-sm text-slate-500">Record a maintenance or other expense</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div>
          <label className={label}>Title <span className="text-rose-500 normal-case">*</span></label>
          <input {...register("title", { required: "Title is required" })} className={field} placeholder="e.g. Pipe repair" />
          {errors.title && <p className={err}>{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Amount <span className="text-rose-500 normal-case">*</span></label>
            <input type="number" step="0.01" {...register("amount", { required: "Required", min: { value: 0.01, message: "Must be > 0" } })} className={field} placeholder="500" />
            {errors.amount && <p className={err}>{errors.amount.message}</p>}
          </div>
          <div>
            <label className={label}>Date <span className="text-rose-500 normal-case">*</span></label>
            <input type="date" {...register("date", { required: "Required" })} className={field} />
            {errors.date && <p className={err}>{errors.date.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Category</label>
            <select {...register("category")} className={field}>
              {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Room</label>
            <select {...register("roomId")} className={field}>
              <option value="">— Common Area —</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{r.floor ? ` (${r.floor})` : ""}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Description</label>
          <textarea {...register("description")} rows={3} className={`${field} resize-none`} placeholder="Optional details..." />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={isSubmitting}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-orange-200">
            {isSubmitting ? "Adding..." : "Add Expense"}
          </button>
          <Link href="/expenses" className="flex-1 text-center border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
