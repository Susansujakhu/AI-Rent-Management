"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete room");
        return;
      }
      setOpen(false);
      toast.success("Room deleted");
      router.push("/rooms");
    } catch {
      toast.error("Failed to delete room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
      >
        Delete
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete Room"
        description="Are you sure you want to delete this room? This cannot be undone."
        confirmLabel="Delete Room"
        variant="destructive"
        loading={loading}
        onConfirm={handleDelete}
      />
    </>
  );
}
