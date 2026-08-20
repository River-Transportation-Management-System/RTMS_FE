"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type MenuItem = {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  badgeCls?: string;
};

export function Sidebar({ role }: { role: "ADMIN" | "CUSTOMER" | "PORT_MANAGER" | "VESSEL_OWNER" }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<string>("overview");

  let items: MenuItem[] = [];

  if (role === "CUSTOMER") {
    items = [
      { id: "overview", label: "Tổng Quan Đặt Chuyến", icon: "📊" },
      { id: "workflow-guide", label: "Quy Trình 6 Bước", icon: "📍" },
      { id: "bookings-list", label: "Danh Sách Đơn Hàng", icon: "📋", badge: "Đơn", badgeCls: "bg-cyan-powder text-deep-teal" },
    ];
  } else if (role === "PORT_MANAGER") {
    items = [
      { id: "overview", label: "Tổng Quan Cảng Bến", icon: "📊" },
      { id: "review-queue", label: "Hàng Chờ Kiểm Duyệt", icon: "⚓", badge: "Cảng", badgeCls: "bg-amber-100 text-amber-800" },
      { id: "final-confirmation", label: "Xác Nhận Hợp Đồng Cuối", icon: "📜", badge: "Ký", badgeCls: "bg-orange-100 text-orange-800" },
      { id: "shipment-tracking", label: "Tiến Trình Giao Nhận", icon: "🚢" },
    ];
  } else if (role === "VESSEL_OWNER") {
    items = [
      { id: "overview", label: "Tổng Quan Đội Tàu", icon: "📊" },
      { id: "match-inbox", label: "Hộp Thư Yêu Cầu Ghép", icon: "📥", badge: "Hộp thư", badgeCls: "bg-blue-100 text-blue-800" },
      { id: "fleet-management", label: "Quản Lý Đội Tàu", icon: "🚤" },
    ];
  } else {
    items = [
      { id: "overview", label: "Tổng Quan Điều Hành", icon: "⚡" },
      { id: "bookings-monitor", label: "Giám Sát Đơn & Lộ Trình", icon: "📋" },
      { id: "job-triggers", label: "Điều Phối & Đôn Đốc Hạn", icon: "🔔", badge: "Tự động", badgeCls: "bg-purple-100 text-purple-800" },
      { id: "data-management", label: "Danh Mục Tàu, Cảng & TV", icon: "👥" },
    ];
  }

  const roleMeta: Record<string, { title: string; color: string; icon: string }> = {
    CUSTOMER: { title: "Chủ Hàng", color: "from-[#71C9CE] to-[#A6E3E9] text-slate-navy", icon: "📦" },
    PORT_MANAGER: { title: "Ban Quản Lý Cảng", color: "from-[#0F4C5C] to-[#142834] text-white", icon: "⚓" },
    VESSEL_OWNER: { title: "Chủ Phương Tiện", color: "from-[#71C9CE] to-[#A6E3E9] text-slate-navy", icon: "🚢" },
    ADMIN: { title: "Điều Hành Hệ Thống", color: "from-[#142834] to-[#0F4C5C] text-white", icon: "⚙️" },
  };

  const currentMeta = roleMeta[role] || { title: role, color: "from-[#71C9CE] to-[#A6E3E9] text-slate-navy", icon: "⚓" };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    // Lắng nghe scroll để tự động highlight menu tương ứng
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;
      for (const item of [...items].reverse()) {
        const el = document.getElementById(item.id);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(item.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [items]);

  return (
    <aside className="w-64 bg-white border-r-2 border-aqua-soft sticky top-16 h-[calc(100vh-64px)] p-4 flex flex-col justify-between shadow-xs select-none flex-shrink-0 z-20">
      <div className="space-y-5">
        {/* User Role Card */}
        <div className={`p-3.5 rounded-2xl bg-gradient-to-r ${currentMeta.color} shadow-xs space-y-1`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentMeta.icon}</span>
            <span className="text-[11px] font-black uppercase tracking-wider">
              {currentMeta.title}
            </span>
          </div>
          <p className="text-xs font-bold truncate">
            {user?.userName || "Đang đăng nhập"}
          </p>
          <p className="text-[10px] opacity-80 truncate">
            {user?.userEmail || ""}
          </p>
        </div>

        {/* Navigation Menu */}
        <div>
          <h3 className="px-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">
            Danh Mục Chức Năng
          </h3>
          <nav className="space-y-1.5">
            {items.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    isActive
                      ? "bg-deep-teal text-white shadow-xs font-extrabold"
                      : "text-slate-navy hover:bg-cyan-powder/40 hover:text-deep-teal"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-md border border-black/10 ${
                      isActive ? "bg-white/20 text-white border-white/30" : item.badgeCls || "bg-cyan-powder text-deep-teal"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-cyan-powder/30 rounded-2xl border border-aqua-soft text-center space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-navy">
          <span>🌾</span>
          <span>Hệ Thống RTMS</span>
        </div>
        <p className="text-[10px] text-deep-teal font-semibold">
          Quản Lý Vận Tải Sông Nước
        </p>
      </div>
    </aside>
  );
}
