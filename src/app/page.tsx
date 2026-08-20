"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { NotificationToastContainer } from "@/components/common/NotificationToast";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const rolePortals = [
    {
      code: "CUSTOMER",
      title: "Phân hệ Chủ Hàng",
      desc: "Dành cho khách hàng gửi hàng: Đặt chuyến vận tải, theo dõi quy trình duyệt cảng, lựa chọn tàu phù hợp và giám sát hành trình giao nhận.",
      path: "/dashboard/customer",
      icon: "📦",
      roleName: "Chủ Hàng",
      badge: "KHÁCH HÀNG",
    },
    {
      code: "PORT_MANAGER",
      title: "Phân hệ Ban Quản Lý Cảng",
      desc: "Dành cho các cảng thủy nội địa: Kiểm duyệt điều kiện bốc xếp tại cảng đi và cảng đến, xác nhận hợp đồng vận tải và cập nhật tiến độ bốc dỡ.",
      path: "/dashboard/port",
      icon: "⚓",
      roleName: "Quản Lý Cảng",
      badge: "CẢNG BẾN",
    },
    {
      code: "VESSEL_OWNER",
      title: "Phân hệ Đội Tàu Vận Tải",
      desc: "Dành cho các chủ phương tiện thủy: Tiếp nhận yêu cầu ghép chuyến, phản hồi nhận/từ chối vận chuyển và quản lý trạng thái đội tàu sẵn sàng.",
      path: "/dashboard/vessel",
      icon: "🚢",
      roleName: "Chủ Tàu",
      badge: "CHỦ PHƯƠNG TIỆN",
    },
    {
      code: "ADMIN",
      title: "Phân hệ Trung Tâm Điều Hành",
      desc: "Dành cho bộ phận điều phối & quản trị: Giám sát toàn bộ luồng vận chuyển đường thủy, quản lý thành viên, đội tàu, mạng lưới cảng và xử lý điều phối.",
      path: "/dashboard/admin",
      icon: "⚙️",
      roleName: "Điều Hành",
      badge: "QUẢN TRỊ VIÊN",
    },
  ];

  const handleNavigate = (path: string, code: string) => {
    if (!isAuthenticated || !user) {
      router.push("/login");
      return;
    }

    if (user.roleCode !== code && user.roleCode !== "ADMIN") {
      alert(`Tài khoản của bạn thuộc vai trò [${user.roleName}]. Vui lòng truy cập đúng phân hệ được cấp phép.`);
      return;
    }

    router.push(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F9FA] via-[#E6F7F9] to-[#CBF1F5]/40 text-slate-navy">
      <Header />
      <NotificationToastContainer />

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-4 py-1.5 rounded-full bg-cyan-powder border border-aqua-soft text-deep-teal font-extrabold text-xs tracking-wide">
            🌊 HỆ THỐNG ĐIỀU HÀNH VẬN TẢI THỦY NỘI ĐỊA (RTMS)
          </span>
          <h1 className="font-heading font-black text-4xl sm:text-5xl text-slate-navy leading-tight">
            Nền tảng Vận tải Đường sông <br />
            <span className="text-deep-teal">Tối Ưu & Liên Kết Toàn Diện</span>
          </h1>
          <p className="text-sm text-gray-600 font-medium leading-relaxed">
            Kết nối chặt chẽ Chủ hàng, Cảng bến, Đội tàu vận chuyển và Trung tâm điều hành qua quy trình 6 bước khép kín, an toàn và minh bạch.
          </p>

          {!isAuthenticated && (
            <div className="pt-2">
              <Link
                href="/login"
                className="btn-primary text-sm px-8 py-3.5 shadow-lg font-bold inline-flex items-center gap-2"
              >
                <span>🔑</span>
                <span>Đăng Nhập Vào Hệ Thống</span>
              </Link>
            </div>
          )}
        </div>

        {/* 4 Separated Role Portals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rolePortals.map((r) => {
            const isUserRole = user?.roleCode === r.code;

            return (
              <div
                key={r.code}
                className={`rtms-card p-6 bg-white flex flex-col justify-between space-y-5 transition-all duration-300 ${
                  isUserRole
                    ? "border-2 border-deep-teal ring-2 ring-deep-teal/20 shadow-lg"
                    : "border border-aqua-soft hover:border-ocean-teal"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-powder flex items-center justify-center text-2xl shadow-xs">
                      {r.icon}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isUserRole && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-deep-teal text-white shadow-xs">
                          Vai trò của bạn
                        </span>
                      )}
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-aqua-soft/50 text-deep-teal border border-aqua-soft font-mono">
                        {r.badge}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-heading font-extrabold text-xl text-slate-navy">
                    {r.title}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed font-medium">
                    {r.desc}
                  </p>
                </div>

                <button
                  onClick={() => handleNavigate(r.path, r.code)}
                  className={`text-xs py-3 w-full text-center shadow-sm font-bold flex items-center justify-center gap-1.5 rounded-xl transition-all ${
                    isUserRole
                      ? "btn-primary"
                      : "bg-cyan-powder/40 text-slate-navy hover:bg-cyan-powder/80 border border-aqua-soft"
                  }`}
                >
                  <span>Truy cập {r.title}</span>
                  <span>→</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Overview */}
        <div className="rtms-card p-6 bg-white border border-aqua-soft flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-bold text-slate-navy">
            Hệ thống Quản lý Vận tải Thủy Nội địa • <span className="text-deep-teal">Vận hành an toàn & liên tục</span>
          </div>

          <div className="text-xs text-gray-500 font-semibold">
            Tối ưu hóa chuỗi cung ứng đường sông miền Nam
          </div>
        </div>
      </main>
    </div>
  );
}
