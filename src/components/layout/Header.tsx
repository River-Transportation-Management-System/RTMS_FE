"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { realtimeHub } from "@/lib/realtime";

export function Header() {
  const { user, logout } = useAuth();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const unsubscribe = realtimeHub.subscribe(() => {
      setNotifCount((prev) => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  const getRoleHeaderInfo = () => {
    if (user?.roleCode === "CUSTOMER") {
      return { title: "Phân hệ Khách Hàng", icon: "📦", bg: "bg-cyan-powder", text: "text-deep-teal" };
    }
    if (user?.roleCode === "PORT_MANAGER") {
      return { title: "Phân hệ Quản Lý Cảng", icon: "⚓", bg: "bg-aqua-soft", text: "text-slate-navy" };
    }
    if (user?.roleCode === "VESSEL_OWNER") {
      return { title: "Phân hệ Chủ Phương Tiện", icon: "🚢", bg: "bg-ocean-teal", text: "text-slate-navy" };
    }
    return { title: "Phân hệ Quản Trị Viên", icon: "⚙️", bg: "bg-slate-navy", text: "text-white" };
  };

  const roleInfo = getRoleHeaderInfo();

  return (
    <header className="sticky top-0 z-40 bg-white border-b-2 border-aqua-soft shadow-xs px-6 py-3 flex items-center justify-between">
      {/* Brand Logo & Dedicated Role Title */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-ocean-teal flex items-center justify-center text-xl text-slate-navy shadow-md font-bold group-hover:scale-105 transition-transform">
            🚢
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-lg text-slate-navy leading-none">
              RTMS Logistics
            </h1>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
              Hệ thống Quản lý Vận tải Đường thủy
            </p>
          </div>
        </Link>

        {/* Dedicated Role Badge Header */}
        {user && (
          <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-aqua-soft shadow-xs ${roleInfo.bg}`}>
            <span className="text-base">{roleInfo.icon}</span>
            <span className={`text-xs font-extrabold ${roleInfo.text}`}>
              {roleInfo.title}
            </span>
          </div>
        )}
      </div>

      {/* User Profile Info & Logout */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative">
          <button
            title="Thông báo hệ thống"
            className="w-9 h-9 rounded-xl bg-cyan-powder/50 hover:bg-cyan-powder flex items-center justify-center text-base text-slate-navy transition-all border border-aqua-soft"
          >
            🔔
          </button>
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center shadow animate-pulse">
              {notifCount}
            </span>
          )}
        </div>

        {/* Logged in User Badge & Logout */}
        {user ? (
          <div className="flex items-center gap-3 pl-3 border-l border-aqua-soft">
            <div className="w-8 h-8 rounded-full bg-deep-teal text-white font-bold text-xs flex items-center justify-center shadow">
              {user.roleCode.charAt(0)}
            </div>
            <div className="hidden sm:block text-left max-w-[140px]">
              <p className="text-xs font-bold text-slate-navy leading-tight truncate">
                {user.userName}
              </p>
              <p className="text-[10px] text-deep-teal font-semibold truncate">
                {user.roleName} ({user.userEmail})
              </p>
            </div>
            <button
              onClick={logout}
              title="Đăng xuất tài khoản"
              className="px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50/50 text-rose-600 hover:bg-rose-100 font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        ) : (
          <Link href="/login" className="btn-primary text-xs px-4 py-2 font-bold shadow-xs">
            🔑 Đăng Nhập
          </Link>
        )}
      </div>
    </header>
  );
}
