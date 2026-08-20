"use client";

import { useEffect, useState } from "react";
import { realtimeHub, RealtimeNotification } from "@/lib/realtime";

const ROLE_TARGET_LABELS: Record<string, string> = {
  CUSTOMER: "Chủ hàng",
  PORT_MANAGER: "Ban Quản lý Cảng",
  VESSEL_OWNER: "Chủ tàu",
  ADMIN: "Điều hành viên",
  ALL: "Các bên liên quan",
};

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<RealtimeNotification[]>([]);

  useEffect(() => {
    const unsubscribe = realtimeHub.subscribe((notif) => {
      setToasts((prev) => [notif, ...prev.slice(0, 4)]);
    });

    return () => unsubscribe();
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderClass = "border-ocean-teal";
        let bgClass = "bg-white";
        let icon = "🔔";

        if (toast.type === "success") {
          borderClass = "border-emerald-400";
          icon = "✅";
        } else if (toast.type === "warning") {
          borderClass = "border-amber-400";
          icon = "⏳";
        } else if (toast.type === "error") {
          borderClass = "border-rose-400";
          icon = "❌";
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border-2 ${borderClass} ${bgClass} transition-all duration-300 transform translate-x-0`}
            style={{ backdropFilter: "blur(8px)" }}
          >
            <span className="text-xl leading-none mt-0.5">{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-heading font-bold text-sm text-slate-navy truncate">
                  {toast.title}
                </h4>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{toast.timestamp}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1 leading-snug">{toast.message}</p>
              {toast.roleTarget && (
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-powder text-deep-teal">
                  Gửi tới: {ROLE_TARGET_LABELS[toast.roleTarget] || toast.roleTarget}
                </span>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-slate-navy text-sm font-bold leading-none p-1"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
