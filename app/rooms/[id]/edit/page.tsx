"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { DoorOpen } from "lucide-react";

type FormData = { name: string; floor: string; monthlyRent: number; description: string };

const field = "w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white dark:bg-slate-800 dark:text-slate-200";
const label = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";
const err   = "text-rose-500 text-xs mt-1.5";

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>();

  useEffect(() => {
    fetch(`/api/rooms/${id}`).then(r => r.json()).then(data => {
      reset({ name: data.name, floor: data.floor ?? "", monthlyRent: data.monthlyRent, description: data.description ?? "" });
    });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      // monthlyRent is now managed via the Rent History panel — don't ship it
      // from this form, otherwise direct edits would silently bypass history.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { monthlyRent: _ignored, ...payload } = data;
      const res = await fetch(`/api/rooms/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast.success("Room updated");
      router.push(`/rooms/${id}`);
    } catch { toast.error("Failed to update room"); }
  };

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
          <DoorOpen size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Room</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Update room details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-5">
        <div>
          <label className={label}>Room Name <span className="text-rose-500 normal-case">*</span></label>
          <input {...register("name", { required: "Room name is required" })} className={field} placeholder="e.g. Room 101" />
          {errors.name && <p className={err}>{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Floor</label>
            <input {...register("floor")} className={field} placeholder="e.g. Ground, 1st" />
          </div>
          <div>
            <label className={label}>Monthly Rent</label>
            <input
              type="number"
              {...register("monthlyRent")}
              disabled
              className={`${field} bg-slate-50 dark:bg-slate-800 cursor-not-allowed text-slate-500 dark:text-slate-400`}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Rent is changed via the <span className="font-semibold">Rent History</span> panel on the room page so history stays intact.
            </p>
          </div>
        </div>

        <div>
          <label className={label}>Description</label>
          <textarea {...register("description")} rows={3} className={`${field} resize-none`} placeholder="Optional notes about this room" />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={isSubmitting}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`/rooms/${id}`} className="flex-1 text-center border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
