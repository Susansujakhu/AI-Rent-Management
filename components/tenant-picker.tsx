"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, ChevronDown, Check } from "lucide-react";
import { useClampPopover } from "@/lib/use-clamp-popover";

export interface TenantOption {
  id:   string;
  name: string;
}

export function TenantPicker({ tenants, value }: { tenants: TenantOption[]; value: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useClampPopover(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const selected = tenants.find(t => t.id === value);
  const active   = !!selected;

  const setTenant = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("tenantId", id);
    else    params.delete("tenantId");
    router.push(`/reports?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 select-none
          ${active
            ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
      >
        <Users size={14} className={active ? "text-indigo-500" : "text-slate-400"} />
        <span className="max-w-[140px] truncate">{selected ? selected.name : "All Tenants"}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${active ? "text-indigo-400" : "text-slate-400"}`} />
      </button>

      {open && (
        <div ref={panelRef}
          className="absolute top-full right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden py-1 max-h-72 overflow-y-auto max-w-[calc(100vw-1rem)]"
          style={{ minWidth: 200 }}
        >
          <button
            onClick={() => setTenant(null)}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2
              ${!value ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-bold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"}`}
          >
            All Tenants
            {!value && <Check size={12} className="ml-auto text-indigo-500" />}
          </button>
          {tenants.length > 0 && <div className="border-t border-slate-100 dark:border-slate-800 my-1" />}
          {tenants.map(t => (
            <button key={t.id}
              onClick={() => setTenant(t.id)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2
                ${value === t.id ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-bold" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              <span className="truncate">{t.name}</span>
              {value === t.id && <Check size={12} className="ml-auto text-indigo-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
