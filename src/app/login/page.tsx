"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_ACCOUNTS, useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login, switchDemoAccount } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("nguyenvana@gmail.com");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; isNetwork?: boolean } | null>(null);
  const [authenticatingEmail, setAuthenticatingEmail] = useState<string | null>(null);

  const redirectToDashboard = (roleCode: string) => {
    if (roleCode === "CUSTOMER") router.push("/dashboard/customer");
    else if (roleCode === "PORT_MANAGER") router.push("/dashboard/port");
    else if (roleCode === "VESSEL_OWNER") router.push("/dashboard/vessel");
    else router.push("/dashboard/admin");
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setLoading(true);
    setAuthenticatingEmail(email);

    try {
      const user = await login(email, password);
      redirectToDashboard(user.roleCode);
    } catch (err: any) {
      const isNet =
        err?.code === "ERR_NETWORK" ||
        err?.message?.includes("kết nối") ||
        err?.message?.includes("Network Error");

      setErrorInfo({
        message: err?.message || "Đăng nhập thất bại. Vui lòng kiểm tra email hoặc mật khẩu.",
        isNetwork: isNet,
      });
    } finally {
      setLoading(false);
      setAuthenticatingEmail(null);
    }
  };

  const handleQuickLogin = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword("123456");
    setErrorInfo(null);
    setLoading(true);
    setAuthenticatingEmail(acc.email);

    try {
      const user = await switchDemoAccount(acc.email);
      redirectToDashboard(user.roleCode);
    } catch (err: any) {
      const isNet =
        err?.code === "ERR_NETWORK" ||
        err?.message?.includes("kết nối") ||
        err?.message?.includes("Network Error");

      setErrorInfo({
        message: err?.message || "Không thể đăng nhập tài khoản.",
        isNetwork: isNet,
      });
    } finally {
      setLoading(false);
      setAuthenticatingEmail(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#CBF1F5] via-[#A6E3E9] to-[#71C9CE] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border-2 border-aqua-soft p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-ocean-teal flex items-center justify-center text-3xl text-slate-navy shadow-lg font-bold mx-auto border-2 border-white">
            🚢
          </div>
          <h1 className="font-heading font-black text-2xl text-slate-navy">
            RTMS Logistics
          </h1>
          <p className="text-xs text-gray-500 font-semibold">
            Hệ thống Quản lý & Điều hành Vận tải Đường thủy
          </p>
        </div>

        {/* Error Alert Box */}
        {errorInfo && (
          <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-800 space-y-1.5 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-xs">
              <span className="text-base">⚠️</span>
              <span>Thông báo:</span>
            </div>
            <p className="text-xs font-medium pl-6 leading-relaxed">
              {errorInfo.message}
            </p>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-gray-700 mb-1 font-bold">Email tài khoản:</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ví dụ: nguyenvana@gmail.com..."
              className="w-full p-3 rounded-xl border border-aqua-soft bg-cyan-powder/20 font-medium text-slate-navy focus:outline-none focus:border-ocean-teal text-xs transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1 font-bold">Mật khẩu:</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu..."
              className="w-full p-3 rounded-xl border border-aqua-soft bg-cyan-powder/20 font-medium text-slate-navy focus:outline-none focus:border-ocean-teal text-xs transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-xs shadow-md font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && authenticatingEmail === email ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang xử lý đăng nhập...</span>
              </>
            ) : (
              <span>🚀 Đăng Nhập Vào Hệ Thống</span>
            )}
          </button>
        </form>

        {/* 4 Demo Accounts Quick Selector */}
        <div className="space-y-3 pt-4 border-t border-aqua-soft">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Tài khoản mẫu theo vai trò công việc:
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {DEMO_ACCOUNTS.map((acc) => {
              const isCurrentSelected = email === acc.email;
              const isLoggingThis = loading && authenticatingEmail === acc.email;

              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickLogin(acc)}
                  disabled={loading}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                    isCurrentSelected
                      ? "border-deep-teal bg-deep-teal/10 shadow-sm ring-1 ring-deep-teal/40"
                      : "border-aqua-soft bg-cyan-powder/20 hover:bg-cyan-powder/60 hover:border-ocean-teal"
                  }`}
                >
                  <span className="text-xl leading-none mt-0.5">{acc.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[11px] text-slate-navy leading-tight truncate">
                        {acc.roleName}
                      </p>
                      {isLoggingThis && (
                        <span className="w-2.5 h-2.5 border-2 border-deep-teal border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-navy/80 font-medium truncate mt-0.5">
                      {acc.label}
                    </p>
                    <p className="text-[9px] text-deep-teal font-mono truncate mt-0.5">
                      {acc.email}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-center text-[10px] text-gray-400 font-medium pt-1">
          Hệ thống Quản lý Vận tải Thủy Nội địa • Bảo mật & An toàn
        </div>
      </div>
    </div>
  );
}
