"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

type Room = {
  id: string;
  name: string;
  floor: string | null;
  monthlyRent: number;
  tenants: { id: string }[];
};

type FormData = {
  name: string;
  phone: string;
  email: string;
  roomId: string;
  moveInDate: string;
  moveOutDate: string;
  deposit: number;
  notes: string;
};

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const moveInDate = watch("moveInDate");

  useEffect(() => {
    Promise.all([
      fetch(`/api/tenants/${id}`).then((r) => r.json()),
      fetch("/api/rooms").then((r) => r.json()),
    ]).then(([tenantData, roomsData]) => {
      setCurrentRoomId(tenantData.roomId ?? "");
      reset({
        name: tenantData.name,
        phone: tenantData.phone,
        email: tenantData.email ?? "",
        roomId: tenantData.roomId ?? "",
        moveInDate: tenantData.moveInDate
          ? new Date(tenantData.moveInDate).toISOString().split("T")[0]
          : "",
        moveOutDate: tenantData.moveOutDate
          ? new Date(tenantData.moveOutDate).toISOString().split("T")[0]
          : "",
        deposit: tenantData.deposit ?? 0,
        notes: tenantData.notes ?? "",
      });
      // Available rooms: vacant rooms + the tenant's current room
      const available = (roomsData as Room[]).filter(
        (r) => r.tenants.length === 0 || r.id === tenantData.roomId
      );
      setRooms(available);
    });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("Tenant updated");
      router.push(`/tenants/${id}`);
    } catch {
      toast.error("Failed to update tenant");
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Tenant</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register("name", { required: "Name is required" })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            {...register("phone", { required: "Phone is required" })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            {...register("email")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
          <select
            {...register("roomId")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— No room —</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}{room.floor ? ` (${room.floor})` : ""} — ₹{room.monthlyRent}/mo
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Move-In Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            {...register("moveInDate", { required: "Move-in date is required" })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.moveInDate && (
            <p className="text-red-500 text-xs mt-1">{errors.moveInDate.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Move-Out Date</label>
          <input
            type="date"
            {...register("moveOutDate", {
              validate: (val) => {
                if (!val || !moveInDate) return true;
                return val >= moveInDate || "Move-out date must be on or after move-in date";
              },
            })}
            min={moveInDate || undefined}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.moveOutDate && (
            <p className="text-red-500 text-xs mt-1">{errors.moveOutDate.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deposit (₹)</label>
          <input
            type="number"
            {...register("deposit", { min: 0 })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            {...register("notes")}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/tenants/${id}`}
            className="flex-1 text-center border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
