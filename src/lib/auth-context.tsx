"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { setActiveActor, setAuthToken } from "@/lib/api-client";
import { getProfile as apiGetProfile, login as apiLogin, logout as apiLogout } from "@/lib/services/auth.service";

export type UserProfile = {
  userId: number;
  userName: string;
  userEmail: string;
  roleCode: "ADMIN" | "CUSTOMER" | "PORT_MANAGER" | "VESSEL_OWNER";
  roleName: string;
};

type AuthContextType = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  switchDemoAccount: (accountEmail: string) => Promise<UserProfile>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Danh sách tài khoản demo trong database để phục vụ đăng nhập
export const DEMO_ACCOUNTS: {
  email: string;
  label: string;
  roleCode: UserProfile["roleCode"];
  userId: number;
  roleName: string;
  icon: string;
  sublabel: string;
}[] = [
  {
    email: "nguyenvana@gmail.com",
    label: "Nguyễn Văn A",
    roleCode: "CUSTOMER",
    userId: 2,
    roleName: "Khách hàng",
    icon: "📦",
    sublabel: "Khách đặt chuyến (User #2)",
  },
  {
    email: "manager.catlai@port.vn",
    label: "Cảng Cát Lái",
    roleCode: "PORT_MANAGER",
    userId: 11,
    roleName: "Quản lý cảng",
    icon: "⚓",
    sublabel: "Quản lý Cảng biển (User #11)",
  },
  {
    email: "owner01@shipping.vn",
    label: "VT Sông Việt 01",
    roleCode: "VESSEL_OWNER",
    userId: 16,
    roleName: "Chủ tàu",
    icon: "🚢",
    sublabel: "Chủ phương tiện (User #16)",
  },
  {
    email: "admin@vesseapp.vn",
    label: "Admin System",
    roleCode: "ADMIN",
    userId: 1,
    roleName: "Quản trị viên",
    icon: "⚙️",
    sublabel: "Quản trị hệ thống (User #1)",
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Xác thực phiên đăng nhập bằng JWT Bearer Token qua API /api/v1/auth/me
    const verifySavedToken = async () => {
      const savedToken = localStorage.getItem("rtms_access_token");

      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      setAuthToken(savedToken);

      try {
        const res: any = await apiGetProfile();
        const p = res.data || {};

        let roleCode: UserProfile["roleCode"] = "CUSTOMER";
        if (p.role?.role_code) {
          roleCode = p.role.role_code as UserProfile["roleCode"];
        } else if (p.role?.role_id === 1 || p.role?.role_id === "1") {
          roleCode = "ADMIN";
        } else if (p.role?.role_id === 3 || p.role?.role_id === "3") {
          roleCode = "PORT_MANAGER";
        } else if (p.role?.role_id === 4 || p.role?.role_id === "4") {
          roleCode = "VESSEL_OWNER";
        }

        const userProfile: UserProfile = {
          userId: Number(p.user_id),
          userName: p.user_name || p.user_email?.split("@")[0] || "User",
          userEmail: p.user_email || "",
          roleCode: roleCode,
          roleName: p.role?.role_name || roleCode,
        };

        setUser(userProfile);
        setActiveActor(userProfile.userId, userProfile.roleCode);
        localStorage.setItem("rtms_user_session", JSON.stringify(userProfile));
      } catch (err) {
        console.warn("[Auth] Token verification failed or expired. Resetting session.");
        localStorage.removeItem("rtms_access_token");
        localStorage.removeItem("rtms_user_session");
        setAuthToken("");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifySavedToken();
  }, []);

  /**
   * Đăng nhập THẬT qua Backend API (/api/v1/auth/login), kiểm tra DB PostgreSQL
   */
  const login = async (email: string, pass: string = "123456"): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const res: any = await apiLogin(email, pass);
      const u = res.data?.user || {};
      const accessToken = res.data?.access_token || "";

      let roleCode: UserProfile["roleCode"] = "CUSTOMER";
      if (u.role_code) {
        roleCode = u.role_code as UserProfile["roleCode"];
      } else if (u.role_id === "1" || u.role_id === 1) {
        roleCode = "ADMIN";
      } else if (u.role_id === "3" || u.role_id === 3) {
        roleCode = "PORT_MANAGER";
      } else if (u.role_id === "4" || u.role_id === 4) {
        roleCode = "VESSEL_OWNER";
      }

      const userProfile: UserProfile = {
        userId: Number(u.user_id),
        userName: u.user_name || email.split("@")[0],
        userEmail: u.user_email || email,
        roleCode: roleCode,
        roleName: u.role_name || roleCode,
      };

      setUser(userProfile);
      setActiveActor(userProfile.userId, userProfile.roleCode);

      if (accessToken) {
        setAuthToken(accessToken);
        localStorage.setItem("rtms_access_token", accessToken);
      }
      localStorage.setItem("rtms_user_session", JSON.stringify(userProfile));

      return userProfile;
    } catch (err: any) {
      const errorMsg =
        err?.message ||
        err?.error?.message ||
        "Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.";

      const customError = new Error(errorMsg);
      (customError as any).code = err?.code || err?.error?.code || "AUTH_FAILED";
      (customError as any).details = err?.details || null;

      throw customError;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Đăng nhập nhanh tài khoản demo qua API thực
   */
  const switchDemoAccount = async (accountEmail: string): Promise<UserProfile> => {
    return login(accountEmail, "123456");
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.warn("Logout notice:", err);
    } finally {
      setUser(null);
      setAuthToken("");
      setActiveActor("1", "ADMIN");
      localStorage.removeItem("rtms_user_session");
      localStorage.removeItem("rtms_access_token");
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchDemoAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
