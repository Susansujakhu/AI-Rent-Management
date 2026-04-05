"use client";

import { useEffect, useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
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
  deposit: number;
  notes: string;
};

function NewTenantForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRoomId = searchParams.get("roomId") ?? "";
  const [rooms, setRooms] = useState<Room[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: { deposit: 0, roomId: preselectedRoomId },
  });

  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((data: Room[]) => {
        // Only rooms without active tenants
        setRooms(data.filter((r) => r.tenants.length === 0));
      });
  }, []);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("Tenant added successfully");
      router.push("/tenants");
    } catch {
      toast.error("Failed to add tenant");
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add New Tenant</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the tenant details below.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register("name", { required: "Name is required" })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Ravi Kumar"
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
            placeholder="e.g. 9876543210"
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            {...register("email")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="optional@email.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assign Room</label>
          <select
            {...register("roomId")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— No room (assign later) —</option>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Deposit (₹)</label>
          <input
            type="number"
            {...register("deposit", { min: 0 })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            {...register("notes")}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Any additional notes..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Adding..." : "Add Tenant"}
          </button>
          <Link
            href="/tenants"
            className="flex-1 text-center border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewTenantPage() {
  return (
    <Suspense>
      <NewTenantForm />
    </Suspense>
  );
}
