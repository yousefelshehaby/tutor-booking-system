"use client";

import { useEffect, useState } from "react";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AdminNotification,
} from "@/app/admin/(protected)/notifications/actions";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[] | null>(null);

  useEffect(() => {
    getMyNotifications().then(setNotifications);
  }, []);

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!notifications) {
      setNotifications(await getMyNotifications());
    }
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, is_read: true } : n)) ?? prev);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? prev);
  }

  return (
    <div className="relative" dir="rtl">
      <button
        type="button"
        onClick={handleOpen}
        className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
        aria-label="الإشعارات"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-10 mt-2 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
            <span className="text-sm font-semibold text-zinc-900">الإشعارات</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:underline">
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications === null && <p className="p-4 text-center text-sm text-zinc-500">جاري التحميل...</p>}
            {notifications && notifications.length === 0 && (
              <p className="p-4 text-center text-sm text-zinc-500">لا توجد إشعارات</p>
            )}
            {notifications?.map((n) => (
              <button
                key={n.id}
                onClick={() => handleMarkRead(n.id)}
                className={`block w-full border-b border-zinc-50 px-4 py-3 text-right text-sm hover:bg-zinc-50 ${
                  n.is_read ? "" : "bg-blue-50"
                }`}
              >
                {n.type === "student_note" ? (
                  <>
                    <p className="font-medium text-zinc-900">
                      ملاحظة جديدة على {n.student_name} ({n.booking_code})
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {n.grade_name} — {n.group_name}
                    </p>
                    {n.note_excerpt && <p className="mt-1 text-xs text-zinc-600">{n.note_excerpt}</p>}
                  </>
                ) : (
                  <p className="font-medium text-zinc-900">{n.message}</p>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(n.created_at).toLocaleString("ar-EG")}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
