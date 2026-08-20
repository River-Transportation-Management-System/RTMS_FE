"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, UserProfile } from "@/lib/auth-context";

type RoleGuardProps = {
  allowedRoles: UserProfile["roleCode"][];
  children: React.ReactNode;
};

const ROLE_DASHBOARD_MAP: Record<UserProfile["roleCode"], string> = {
  CUSTOMER: "/dashboard/customer",
  PORT_MANAGER: "/dashboard/port",
  VESSEL_OWNER: "/dashboard/vessel",
  ADMIN: "/dashboard/admin",
};

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      // 1. Chưa đăng nhập hoặc không có token hợp lệ
      if (!isAuthenticated || !user) {
        router.replace("/login");
        return;
      }

      // 2. Không đúng role được phép truy cập trang này -> Điều hướng về đúng Dashboard của vai trò đó
      if (!allowedRoles.includes(user.roleCode)) {
        const targetPath = ROLE_DASHBOARD_MAP[user.roleCode] || "/login";
        router.replace(targetPath);
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cyan-powder/20 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-full border-4 border-ocean-teal border-t-transparent animate-spin mb-3"></div>
        <p className="text-xs font-bold text-slate-navy">Đang xác thực mã Token & Quyền truy cập...</p>
      </div>
    );
  }

  // Nếu chưa đăng nhập hoặc không đúng quyền, không render nội dung
  if (!isAuthenticated || !user || !allowedRoles.includes(user.roleCode)) {
    return (
      <div className="min-h-screen bg-cyan-powder/20 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-md text-center space-y-3 border border-aqua-soft">
          <span className="text-3xl">🚫</span>
          <h3 className="font-heading font-bold text-base text-slate-navy">Khu vực phân quyền riêng biệt</h3>
          <p className="text-xs text-gray-500">
            Tài khoản của bạn thuộc vai trò <strong>{user?.roleName || user?.roleCode}</strong>. Đang chuyển hướng về đúng phân hệ được cấp quyền...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
