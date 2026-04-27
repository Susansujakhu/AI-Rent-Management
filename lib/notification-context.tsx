"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

export interface AppNotification {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  data:      string | null;
  read:      boolean;
  createdAt: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount:   number;
  markRead:      (id: string) => void;
  markAllRead:   () => void;
  refresh:       () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const knownIds    = useRef<Set<string>>(new Set());
  const firstLoad   = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: AppNotification[]; unreadCount: number };

      // Browser desktop notifications for genuinely new unread entries
      if (typeof window !== "undefined" && Notification.permission === "granted") {
        if (firstLoad.current) {
          data.notifications.forEach(n => knownIds.current.add(n.id));
          firstLoad.current = false;
        } else {
          const incoming = data.notifications.filter(n => !knownIds.current.has(n.id) && !n.read);
          data.notifications.forEach(n => knownIds.current.add(n.id));
          incoming.forEach(n => {
            try { new Notification(n.title, { body: n.body, icon: "/favicon.ico" }); } catch {}
          });
        }
      } else if (firstLoad.current) {
        data.notifications.forEach(n => knownIds.current.add(n.id));
        firstLoad.current = false;
      }

      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const markRead = useCallback(async (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${notifId}/read`, { method: "PATCH" }).catch(() => null);
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => null);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}
