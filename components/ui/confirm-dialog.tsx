"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  title:         string;
  description:   string;
  confirmLabel?: string;
  variant?:      "destructive" | "warning" | "default";
  loading?:      boolean;
  onConfirm:     () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "default",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {variant !== "default" && (
              <div className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5",
                variant === "destructive" && "bg-red-50",
                variant === "warning"     && "bg-amber-50",
              )}>
                <AlertTriangle size={20} className={cn(
                  variant === "destructive" && "text-red-600",
                  variant === "warning"     && "text-amber-500",
                )} />
              </div>
            )}
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-slate-900 leading-snug">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); }}
            disabled={loading}
            className={cn(
              "flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50",
              variant === "destructive" && "bg-red-600 hover:bg-red-700",
              variant === "warning"     && "bg-amber-500 hover:bg-amber-600",
              variant === "default"     && "bg-indigo-600 hover:bg-indigo-700",
            )}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
