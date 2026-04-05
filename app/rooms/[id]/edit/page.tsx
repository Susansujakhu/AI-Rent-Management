"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

type FormData = {
  name: string;
  floor: string;
  monthlyRent: number;
  description: string;
};

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  useEffect(() => {
    fetch(`/api/rooms/${id}`)
      .then((r) => r.json())
      .then((data) => {
        reset({
          name: data.name,
          floor: data.floor ?? "",
          monthlyRent: data.monthlyRent,
          description: data.description ?? "",
        });
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("Room updated");
      router.push(`/rooms/${id}`);
    } catch {
      toast.error("Failed to update room");
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Room</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register("name", { required: "Room name is required" })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
          <input
            {...register("floor")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Monthly Rent (₹) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            {...register("monthlyRent", { required: "Monthly rent is required", min: 1 })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.monthlyRent && (
            <p className="text-red-500 text-xs mt-1">{errors.monthlyRent.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            {...register("description")}
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
            href={`/rooms/${id}`}
            className="flex-1 text-center border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
