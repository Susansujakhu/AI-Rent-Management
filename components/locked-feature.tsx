"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { UpgradeModal } from "./upgrade-modal";

interface Props {
  feature: string;           // shown in the modal title
  children: React.ReactNode; // the locked content / button
  className?: string;
}

/**
 * Wraps any element with a click handler that shows the upgrade modal.
 * Use this to lock pro features in the UI.
 *
 * Example:
 *   <LockedFeature feature="WhatsApp notifications">
 *     <button className="...">Send Reminder</button>
 *   </LockedFeature>
 */
export function LockedFeature({ feature, children, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={`relative cursor-not-allowed select-none ${className ?? ""}`}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
      >
        <div className="pointer-events-none opacity-50">{children}</div>
        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full shadow">
          <Lock size={8} strokeWidth={3} />PRO
        </span>
      </div>
      <UpgradeModal open={open} onClose={() => setOpen(false)} feature={feature} />
    </>
  );
}

/**
 * A standalone "Add" button that is either a normal link (unlocked) or a locked pro button.
 * Used in rooms/tenants list pages.
 */
interface AddButtonProps {
  href:     string;
  label:    string;
  locked:   boolean;
  feature:  string;
  icon:     React.ReactNode;
  className?: string;
}

export function AddButton({ href, label, locked, feature, icon, className }: AddButtonProps) {
  const [open, setOpen] = useState(false);
  const cls = className ?? "inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-200 shrink-0";

  if (!locked) {
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    return <a href={href} className={cls}>{icon}{label}</a>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${cls} opacity-80`}
      >
        {icon}
        {label}
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-400 text-white text-[9px] font-bold rounded-full">
          <Lock size={8} strokeWidth={3} />PRO
        </span>
      </button>
      <UpgradeModal open={open} onClose={() => setOpen(false)} feature={feature} />
    </>
  );
}
