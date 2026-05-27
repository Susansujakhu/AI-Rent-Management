"use client";

import { Bell, CheckCheck, Zap, X } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useNotifications } from "@/lib/notification-context";
import { cn } from "@/lib/utils";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleToggle = () => {
    if (!open && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setOpen(o => !o);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-all duration-150"
        title="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Open below the button, anchored to its right edge. Works whether
        // the bell lives in the desktop sidebar (upper-left of screen) or
        // the mobile header (upper-right) — the dropdown never falls off
        // the viewport. max-w + viewport-aware width keeps it on screen on
        // small phones.
        <div className="absolute top-full right-0 mt-2 z-[100] w-[min(20rem,calc(100vw-2rem))] bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell size={12} className="text-slate-500" />
              <span className="text-sm font-bold text-slate-200">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                >
                  <CheckCheck size={11} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-300 transition-colors ml-1">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Bell size={22} className="text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { markRead(n.id); }}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-slate-800/40 transition-colors flex gap-3 items-start",
                    !n.read && "bg-indigo-500/5"
                  )}
                >
                  <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={12} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-xs font-semibold leading-snug",
                      n.read ? "text-slate-400" : "text-slate-200"
                    )}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
