"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DeleteRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this room? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete room");
        return;
      }
      toast.success("Room deleted");
      router.push("/rooms");
    } catch {
      toast.error("Failed to delete room");
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
    >
      Delete
    </button>
  );
}
