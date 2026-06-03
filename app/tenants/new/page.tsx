"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Users, Paperclip, X, FileText, Image, DoorOpen } from "lucide-react";

type Room = { id: string; name: string; floor: string | null; monthlyRent: number; tenants: { id: string }[] };
type FormData = { name: string; phone: string; email: string; roomId: string; moveInDate: string; deposit: number; notes: string };

// Sentinel value used by the Assign Room <option> that opens the add-room modal.
const ADD_ROOM = "__add_room__";

type RoomFormData = { name: string; floor: string; monthlyRent: number; description: string };

// Inline "create room" modal. Portaled to <body> so its <form> isn't nested
// inside the tenant <form> (nested forms are invalid HTML). Calls onCreated
// with the new room so the caller can select it.
function AddRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: (room: Room) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RoomFormData>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (data: RoomFormData) => {
    try {
      const res  = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({})) as { id?: string; name?: string; floor?: string | null; monthlyRent?: number; error?: string; upgrade?: boolean };
      if (!res.ok) {
        if (body.upgrade) { toast.error(`Pro required — ${body.error}`); return; }
        throw new Error(body.error ?? "Failed to create room");
      }
      toast.success("Room created");
      onCreated({ id: body.id!, name: body.name!, floor: body.floor ?? null, monthlyRent: body.monthlyRent ?? Number(data.monthlyRent), tenants: [] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to create room"); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
              <DoorOpen size={15} className="text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Add New Room</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="p-6 space-y-5">
          <div>
            <label className={label}>Room Name <span className="text-rose-500 normal-case">*</span></label>
            <input autoFocus {...register("name", { required: "Room name is required" })} className={field} placeholder="e.g. Room 101, Big Room" />
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
            <textarea {...register("description")} rows={2} className={`${field} resize-none`} placeholder="Optional notes about this room" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={isSubmitting}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200">
              {isSubmitting ? "Creating…" : "Create & Select"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 text-center border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

const field = "w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white dark:bg-slate-800 dark:text-slate-200";
const label = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";
const err   = "text-rose-500 text-xs mt-1.5";

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <Image size={13} className="text-blue-500" />;
  return <FileText size={13} className="text-slate-400" />;
}
function fmtSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function NewTenantForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRoomId = searchParams.get("roomId") ?? "";
  const [rooms, setRooms] = useState<Room[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { deposit: 0, roomId: preselectedRoomId },
  });
  const roomReg     = register("roomId");
  const selectedRoom = watch("roomId");

  useEffect(() => {
    fetch("/api/rooms").then(r => r.json()).then((data: Room[]) => setRooms(data.filter(r => r.tenants.length === 0)));
  }, []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).filter(f => f.size <= 10 * 1024 * 1024);
    const oversized = Array.from(files).filter(f => f.size > 10 * 1024 * 1024);
    if (oversized.length) toast.error(`${oversized.length} file(s) skipped — max 10 MB each`);
    setPendingFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...next.filter(f => !names.has(f.name))];
    });
  };

  const removeFile = (name: string) => setPendingFiles(prev => prev.filter(f => f.name !== name));

  const onSubmit = async (data: FormData) => {
    try {
      const res  = await fetch("/api/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({})) as { id?: string; error?: string; upgrade?: boolean };
      if (!res.ok) {
        if (body.upgrade) { toast.error(`Pro required — ${body.error}`); return; }
        throw new Error(body.error ?? "Failed to add tenant");
      }

      const tenantId = body.id!;

      if (pendingFiles.length > 0) {
        setUploading(true);
        const results = await Promise.allSettled(
          pendingFiles.map(file => {
            const form = new FormData();
            form.append("file", file);
            return fetch(`/api/tenants/${tenantId}/documents`, { method: "POST", body: form });
          })
        );
        const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)).length;
        if (failed > 0) toast.error(`${failed} file(s) failed to upload`);
        setUploading(false);
      }

      toast.success("Tenant added successfully");
      router.push(`/tenants/${tenantId}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to add tenant"); }
  };

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm shadow-violet-200">
          <Users size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Add New Tenant</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Fill in the tenant details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={label}>Full Name <span className="text-rose-500 normal-case">*</span></label>
            <input {...register("name", { required: "Name is required" })} className={field} placeholder="e.g. Ravi Kumar" />
            {errors.name && <p className={err}>{errors.name.message}</p>}
          </div>
          <div>
            <label className={label}>Phone <span className="text-rose-500 normal-case">*</span></label>
            <input {...register("phone", {
              required: "Phone is required",
              pattern: { value: /^\+?\d{7,15}$/, message: "Enter a valid phone number (7–15 digits, digits only)" },
            })} className={field} placeholder="98XXXXXXXX" />
            {errors.phone && <p className={err}>{errors.phone.message}</p>}
          </div>
          <div>
            <label className={label}>Email <span className="text-rose-400 normal-case font-normal">*</span></label>
            <input type="email" {...register("email", {
              required: "Email is required",
              pattern:  { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
            })} className={field} placeholder="tenant@example.com" />
            {errors.email && <p className={err}>{errors.email.message}</p>}
          </div>
        </div>

        <div>
          <label className={label}>Assign Room</label>
          <select
            name={roomReg.name}
            ref={roomReg.ref}
            onBlur={roomReg.onBlur}
            value={selectedRoom ?? ""}
            className={field}
            onChange={e => {
              // Opening the modal must not leave the sentinel selected, so we
              // don't write it to form state — just open and keep the prior value.
              if (e.target.value === ADD_ROOM) { setShowRoomModal(true); return; }
              setValue("roomId", e.target.value, { shouldDirty: true });
            }}
          >
            <option value="">— No room (assign later) —</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}{r.floor ? ` (${r.floor})` : ""} — {r.monthlyRent}/mo</option>
            ))}
            <option value={ADD_ROOM}>+ Add new room…</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Move-In Date <span className="text-rose-500 normal-case">*</span></label>
            <input type="date" {...register("moveInDate", { required: "Required" })} className={field} />
            {errors.moveInDate && <p className={err}>{errors.moveInDate.message}</p>}
          </div>
          <div>
            <label className={label}>Deposit</label>
            <input type="number" {...register("deposit", { min: 0 })} className={field} placeholder="0" />
          </div>
        </div>

        <div>
          <label className={label}>Notes</label>
          <textarea {...register("notes")} rows={3} className={`${field} resize-none`} placeholder="Any additional notes..." />
        </div>

        {/* Document uploads */}
        <div>
          <label className={label}>Documents <span className="normal-case font-normal text-slate-400">lease, ID, citizenship… (optional)</span></label>
          <div
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/10 transition-all"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            <Paperclip size={18} className="mx-auto text-slate-300 mb-1.5" />
            <p className="text-xs text-slate-400">Click to choose files or drag & drop</p>
            <p className="text-[11px] text-slate-300 mt-0.5">PDF, images, Word, Excel — max 10 MB each</p>
            <input
              ref={fileInputRef} type="file" multiple className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,image/*,application/pdf"
              onChange={e => addFiles(e.target.files)}
            />
          </div>

          {pendingFiles.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {pendingFiles.map(f => (
                <li key={f.name} className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
                  {fileIcon(f.type)}
                  <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 truncate font-medium">{f.name}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{fmtSize(f.size)}</span>
                  <button type="button" onClick={() => removeFile(f.name)} className="shrink-0 text-slate-300 hover:text-rose-400 transition-colors">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={isSubmitting || uploading}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-200">
            {uploading ? "Uploading files…" : isSubmitting ? "Adding…" : pendingFiles.length > 0 ? `Add Tenant & Upload ${pendingFiles.length} File${pendingFiles.length > 1 ? "s" : ""}` : "Add Tenant"}
          </button>
          <Link href="/tenants" className="flex-1 text-center border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </Link>
        </div>
      </form>

      {showRoomModal && (
        <AddRoomModal
          onClose={() => setShowRoomModal(false)}
          onCreated={room => {
            setRooms(prev => [...prev, room]);
            setValue("roomId", room.id, { shouldValidate: true, shouldDirty: true });
            setShowRoomModal(false);
          }}
        />
      )}
    </div>
  );
}

export default function NewTenantPage() {
  return <Suspense><NewTenantForm /></Suspense>;
}
