"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const router  = useRouter();
  const [busy,  setBusy]    = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handleVoid = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Payment reversed");
      router.refresh();
    } catch {
      toast.error("Failed to reverse payment");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  if (confirm) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={handleVoid}
          disabled={busy}
          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "..." : "Yes, void"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs text-gray-500 hover:text-gray-700 px-1"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-xs text-red-500 hover:text-red-700 underline"
    >
      Void
    </button>
  );
}
