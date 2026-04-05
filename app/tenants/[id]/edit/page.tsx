"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Users } from "lucide-react";

type Room = { id: string; name: string; floor: string | null; monthlyRent: number; tenants: { id: string }[] };
type FormData = { name: string; phone: string; email: string; roomId: string; moveInDate: string; moveOutDate: string; deposit: number; notes: string };

const field = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white";
const label = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const err   = "text-rose-500 text-xs mt-1.5";

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [rooms, setRooms] = useState<Room[]>([]);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>();
  const moveInDate = watch("moveInDate");

  useEffect(() => {
    Promise.all([
      fetch(`/api/tenants/${id}`).then(r => r.json()),
      fetch("/api/rooms").then(r => r.json()),
    ]).then(([tenantData, roomsData]) => {
      reset({
        name: tenantData.name,
        phone: tenantData.phone,
        email: tenantData.email ?? "",
        roomId: tenantData.roomId ?? "",
        moveInDate: tenantData.moveInDate ? new Date(tenantData.moveInDate).toISOString().split("T")[0] : "",
        moveOutDate: tenantData.moveOutDate ? new Date(tenantData.moveOutDate).toISOString().split("T")[0] : "",
        deposit: tenantData.deposit ?? 0,
        notes: tenantData.notes ?? "",
      });
      setRooms((roomsData as Room[]).filter(r => r.tenants.length === 0 || r.id === tenantData.roomId));
    });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch(`/api/tenants/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      toast.success("Tenant updated");
      router.push(`/tenants/${id}`);
    } catch { toast.error("Failed to update tenant"); }
  };

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm shadow-violet-200">
          <Users size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Tenant</h1>
          <p className="text-sm text-slate-500">Update tenant details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={label}>Full Name <span className="text-rose-500 normal-case">*</span></label>
            <input {...register("name", { required: "Name is required" })} className={field} placeholder="e.g. Ravi Kumar" />
            {errors.name && <p className={err}>{errors.name.message}</p>}
          </div>
          <div>
            <label className={label}>Phone <span className="text-rose-500 normal-case">*</span></label>
            <input {...register("phone", { required: "Phone is required" })} className={field} placeholder="98XXXXXXXX" />
            {errors.phone && <p className={err}>{errors.phone.message}</p>}
          </div>
          <div>
            <label className={label}>Email</label>
            <input type="email" {...register("email")} className={field} placeholder="optional@email.com" />
          </div>
        </div>

        <div>
          <label className={label}>Assign Room</label>
          <select {...register("roomId")} className={field}>
            <option value="">— No room —</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}{r.floor ? ` (${r.floor})` : ""} — {r.monthlyRent}/mo</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Move-In Date <span className="text-rose-500 normal-case">*</span></label>
            <input type="date" {...register("moveInDate", { required: "Required" })} className={field} />
            {errors.moveInDate && <p className={err}>{errors.moveInDate.message}</p>}
          </div>
          <div>
            <label className={label}>Move-Out Date</label>
            <input type="date" {...register("moveOutDate", {
              validate: val => { if (!val || !moveInDate) return true; return val >= moveInDate || "Must be on or after move-in"; }
            })} min={moveInDate || undefined} className={field} />
            {errors.moveOutDate && <p className={err}>{errors.moveOutDate.message}</p>}
          </div>
        </div>

        <div>
          <label className={label}>Deposit</label>
          <input type="number" {...register("deposit", { min: 0 })} className={field} placeholder="0" />
        </div>

        <div>
          <label className={label}>Notes</label>
          <textarea {...register("notes")} rows={3} className={`${field} resize-none`} placeholder="Any additional notes..." />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={isSubmitting}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`/tenants/${id}`} className="flex-1 text-center border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
