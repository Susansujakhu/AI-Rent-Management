"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Props {
  tenantId:     string;
  tenantName:   string;
  paymentCount: number;
}

export function DeletePastTenantButton({ tenantId, tenantName, paymentCount }: Props) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete tenant");
        return;
      }
      setOpen(false);
      toast.success(`${tenantName} and all their records have been deleted`);
      router.refresh();
    } catch {
      toast.error("Failed to delete tenant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
        title="Delete tenant"
      >
        <Trash2 size={14} />
      </button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${tenantName}?`}
        description={
          paymentCount > 0
            ? `This will permanently delete ${tenantName} and their ${paymentCount} payment record${paymentCount !== 1 ? "s" : ""}. This cannot be undone.`
            : `This will permanently delete ${tenantName} and all their records. This cannot be undone.`
        }
        confirmLabel="Delete Tenant"
        variant="destructive"
        loading={loading}
        onConfirm={handleDelete}
      />
    </>
  );
}
