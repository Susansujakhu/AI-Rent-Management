"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { DoorOpen, UserPlus, CheckCircle2 } from "lucide-react";

type FormData = { name: string; floor: string; monthlyRent: number; description: string };

const field = "w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white dark:bg-slate-800 dark:text-slate-200";
const label = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";
const err   = "text-rose-500 text-xs mt-1.5";

// Non-blocking prompt shown after a room is created: offer to add a tenant to
// it right away (preselecting the room via ?roomId), or just finish.
function AddTenantPrompt({ roomId, roomName, onDone }: { roomId: string; roomName: string; onDone: () => void }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={e => { if (e.target === e.currentTarget) onDone(); }}>
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 text-center animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 size={24} className="text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Room created</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{roomName}</span> is ready. Add a tenant to it now?
        </p>
        <div className="flex flex-col gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => router.push(`/tenants/new?roomId=${roomId}`)}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            <UserPlus size={15} /> Add Tenant
          </button>
          <button
            type="button"
            onClick={() => router.push("/rooms")}
            className="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function NewRoomPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>();
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const onSubmit = async (data: FormData) => {
    try {
      const res  = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({})) as { id?: string; name?: string; error?: string; upgrade?: boolean };
      if (!res.ok) {
        if (body.upgrade) { toast.error(`Pro required — ${body.error}`); return; }
        throw new Error(body.error ?? "Failed to create room");
      }
      toast.success("Room created successfully");
      setCreated({ id: body.id!, name: body.name ?? data.name });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to create room"); }
  };

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
          <DoorOpen size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Add New Room</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Fill in the room details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-5">
        <div>
          <label className={label}>Room Name <span className="text-rose-500 normal-case">*</span></label>
          <input {...register("name", { required: "Room name is required" })} className={field} placeholder="e.g. Room 101, Big Room" />
          {errors.name && <p className={err}>{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Floor</label>
            <input {...register("floor")} className={field} placeholder="e.g. Ground, 1st" />
          </div>
          <div>
            <label className={label}>Monthly Rent <span className="text-rose-500 normal-case">*</span></label>
            <input type="number" {...register("monthlyRent", { required: "Required", min: { value: 1, message: "Must be > 0" } })} className={field} placeholder="e.g. 8000" />
            {errors.monthlyRent && <p className={err}>{errors.monthlyRent.message}</p>}
          </div>
        </div>

        <div>
          <label className={label}>Description</label>
          <textarea {...register("description")} rows={3} className={`${field} resize-none`} placeholder="Optional notes about this room" />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={isSubmitting}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200">
            {isSubmitting ? "Creating..." : "Create Room"}
          </button>
          <Link href="/rooms" className="flex-1 text-center border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </Link>
        </div>
      </form>

      {created && (
        <AddTenantPrompt roomId={created.id} roomName={created.name} onDone={() => router.push("/rooms")} />
      )}
    </div>
  );
}
