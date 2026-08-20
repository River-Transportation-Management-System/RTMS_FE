"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationToastContainer } from "@/components/common/NotificationToast";
import { setActiveActor } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { listBookings } from "@/lib/services/booking.service";
import { listPorts } from "@/lib/services/port.service";
import { listUsers } from "@/lib/services/user.service";
import { listVessels } from "@/lib/services/vessel.service";
import {
  getWorkflowSnapshot,
  publishEvent,
  triggerJobBookingExpired,
  triggerJobSendReminder,
  triggerJobVesselTimeout,
} from "@/lib/services/workflow.service";
import { realtimeHub } from "@/lib/realtime";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { getRouteDetail } from "@/lib/routes";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING_PORT_REVIEW:        { label: "Chờ Cảng Duyệt",       cls: "bg-amber-100 text-amber-800 border border-amber-300" },
  WAITING_VESSEL_RESPONSE:    { label: "Chờ Tàu Phản Hồi",      cls: "bg-blue-100 text-blue-800 border border-blue-300" },
  VESSEL_CANDIDATES_READY:    { label: "Có Tàu Ứng Viên",       cls: "bg-cyan-100 text-cyan-800 border border-cyan-300" },
  WAITING_CUSTOMER_SELECTION: { label: "Chờ Khách Chọn Tàu",    cls: "bg-purple-100 text-purple-800 border border-purple-300" },
  WAITING_FINAL_CONFIRMATION: { label: "Chờ XN Cuối",           cls: "bg-orange-100 text-orange-800 border border-orange-300" },
  CONFIRMED:                  { label: "Đã Xác Nhận",           cls: "bg-green-100 text-green-800 border border-green-300" },
  IN_PROGRESS:                { label: "Đang Vận Chuyển",       cls: "bg-emerald-100 text-emerald-800 border border-emerald-300" },
  COMPLETED:                  { label: "Hoàn Thành",            cls: "bg-teal-100 text-teal-800 border border-teal-300" },
  REJECTED_BY_PORT:           { label: "Cảng Từ Chối",          cls: "bg-red-100 text-red-800 border border-red-300" },
  INVALID_ROUTE:              { label: "Tuyến Không Hợp Lệ",    cls: "bg-red-100 text-red-700 border border-red-300" },
  NO_VESSEL_AVAILABLE:        { label: "Không Có Tàu",          cls: "bg-rose-100 text-rose-800 border border-rose-300" },
  NO_VESSEL_ACCEPTED:         { label: "Không Tàu Nào Nhận",    cls: "bg-rose-100 text-rose-700 border border-rose-300" },
  EXPIRED:                    { label: "Hết Hạn",               cls: "bg-gray-100 text-gray-600 border border-gray-300" },
  CANCELLED:                  { label: "Đã Hủy",                cls: "bg-gray-100 text-gray-500 border border-gray-300" },
  FAILED:                     { label: "Thất Bại",              cls: "bg-red-100 text-red-900 border border-red-300" },
};

const REMINDER_CONTEXTS = [
  { value: "PORT_REVIEW_PENDING",        label: "Đôn đốc 2 Cảng kiểm duyệt bốc dỡ" },
  { value: "VESSEL_RESPONSE_PENDING",    label: "Đôn đốc Chủ tàu phản hồi ghép chuyến" },
  { value: "CUSTOMER_SELECTION_PENDING", label: "Nhắc Chủ hàng chọn tàu vận chuyển" },
  { value: "FINAL_CONFIRMATION_PENDING", label: "Đôn đốc Cảng xác nhận hợp đồng cuối" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: "bg-gray-100 text-gray-600 border border-gray-300" };
  return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

const ERROR_STATUSES = ["CANCELLED","REJECTED_BY_PORT","EXPIRED","FAILED","INVALID_ROUTE","NO_VESSEL_AVAILABLE","NO_VESSEL_ACCEPTED"];

export default function AdminDashboard() {
  const { user } = useAuth();

  const [users, setUsers]             = useState<any[]>([]);
  const [vessels, setVessels]         = useState<any[]>([]);
  const [ports, setPorts]             = useState<any[]>([]);
  const [bookings, setBookings]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [workflowSnapshot, setWorkflowSnapshot]   = useState<any | null>(null);
  const [loadingSnapshot, setLoadingSnapshot]     = useState(false);
  const [showDetailModal, setShowDetailModal]     = useState(false);
  const [eventLogs, setEventLogs]                 = useState<any[]>([]);
  const [reminderContext, setReminderContext]      = useState("VESSEL_RESPONSE_PENDING");
  const [bookingFilter, setBookingFilter]         = useState("ALL");
  const [activeTab, setActiveTab]                 = useState<"vessels" | "ports" | "users">("vessels");

  const fetchWorkflowSnapshot = useCallback(async (id: number) => {
    setSelectedBookingId(id);
    setWorkflowSnapshot(null);
    setLoadingSnapshot(true);
    try {
      const res: any = await getWorkflowSnapshot(id);
      setWorkflowSnapshot(res?.data ?? null);
    } catch (err) {
      console.error("[Admin] workflow snapshot error:", err);
      setWorkflowSnapshot(null);
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (user) {
        setActiveActor(user.userId, user.roleCode);
      }

      const [uRes, vRes, pRes, bRes]: any[] = await Promise.all([
        listUsers(1, 50),
        listVessels({ page: 1, limit: 50 }),
        listPorts(),
        listBookings({ page: 1, limit: 50 }),
      ]);

      const uItems: any[] = Array.isArray(uRes?.data) ? uRes.data : uRes?.data?.items ?? [];
      const vItems: any[] = vRes?.data?.items ?? [];
      const pItems: any[] = pRes?.data?.items ?? [];
      const bItems: any[] = bRes?.data?.items ?? [];

      setUsers(uItems);
      setVessels(vItems);
      setPorts(pItems);
      setBookings(bItems);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || "Không thể tải dữ liệu điều hành";
      setError(msg);
      console.error("[Admin] fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDetail = (bookingId: number) => {
    setSelectedBookingId(bookingId);
    setShowDetailModal(true);
    fetchWorkflowSnapshot(bookingId);
  };

  const handleTriggerJob = async (jobName: string) => {
    const targetBookingId = selectedBookingId;
    try {
      let res: any;
      if (jobName === "booking-expired") {
        res = await triggerJobBookingExpired();
      } else if (jobName === "vessel-timeout") {
        res = await triggerJobVesselTimeout();
      } else if (jobName === "send-reminder" && targetBookingId) {
        res = await triggerJobSendReminder({
          booking_ids: [targetBookingId],
          reminder_target_context: reminderContext,
        });
      } else {
        alert("Vui lòng chọn một Đơn vận chuyển trước khi gửi thông báo.");
        return;
      }

      const msg = res?.data?.message || `Thao tác "${jobName}" đã hoàn tất thành công`;
      realtimeHub.notify({ title: `⚡ Điều phối: ${jobName}`, message: msg, type: "success" });

      setEventLogs(prev => [
        {
          id: Date.now(),
          event: jobName === "send-reminder" ? "Gửi thông báo đôn đốc" : jobName === "booking-expired" ? "Xử lý đơn quá hạn" : "Đóng yêu cầu ghép tàu",
          booking_id: targetBookingId,
          context: jobName === "send-reminder" ? reminderContext : undefined,
          message: msg,
          timestamp: new Date().toLocaleTimeString("vi-VN"),
        },
        ...prev.slice(0, 19),
      ]);
      fetchData();
    } catch (err: any) {
      alert("Lỗi điều phối: " + (err.error?.message || err.message || "Lỗi thao tác"));
    }
  };

  const handlePublishEvent = async () => {
    if (!selectedBookingId) { alert("Vui lòng chọn một Đơn vận chuyển."); return; }
    try {
      const res: any = await publishEvent({
        event_name: "admin.manual_override",
        entity_ids: { booking_id: selectedBookingId },
        payload: { triggered_by: "admin_dashboard", context: "manual_operation" },
        source_service: "admin_dashboard",
        timestamp: new Date().toISOString(),
      });
      realtimeHub.notify({
        title: "📡 Phát Thông Báo Điều Phối Khẩn",
        message: `Đơn #${selectedBookingId} đã được phát thông báo điều phối tới các bên liên quan.`,
        type: "info",
      });
      setEventLogs(prev => [
        { id: Date.now(), event: "Điều phối khẩn cấp", booking_id: selectedBookingId, message: `Phát thông báo cho đơn #${selectedBookingId}`, timestamp: new Date().toLocaleTimeString("vi-VN") },
        ...prev.slice(0, 19),
      ]);
    } catch (err: any) {
      alert("Lỗi phát thông báo: " + (err.error?.message || err.message || "Lỗi thao tác"));
    }
  };

  const statsActive     = bookings.filter(b => ["PENDING_PORT_REVIEW","WAITING_VESSEL_RESPONSE","VESSEL_CANDIDATES_READY","WAITING_CUSTOMER_SELECTION","WAITING_FINAL_CONFIRMATION","CONFIRMED"].includes(b.booking_status)).length;
  const statsInProgress = bookings.filter(b => b.booking_status === "IN_PROGRESS").length;
  const statsCompleted  = bookings.filter(b => b.booking_status === "COMPLETED").length;
  const statsFailed     = bookings.filter(b => ERROR_STATUSES.includes(b.booking_status)).length;

  const getFilteredBookings = () => {
    switch (bookingFilter) {
      case "ACTIVE":      return bookings.filter(b => ["PENDING_PORT_REVIEW","WAITING_VESSEL_RESPONSE","VESSEL_CANDIDATES_READY","WAITING_CUSTOMER_SELECTION","WAITING_FINAL_CONFIRMATION","CONFIRMED"].includes(b.booking_status));
      case "IN_PROGRESS": return bookings.filter(b => b.booking_status === "IN_PROGRESS");
      case "COMPLETED":   return bookings.filter(b => b.booking_status === "COMPLETED");
      case "FAILED":      return bookings.filter(b => ERROR_STATUSES.includes(b.booking_status));
      default:            return bookings;
    }
  };

  const selectedBookingData = bookings.find(b => b.booking_id === selectedBookingId);
  const selectedRouteInfo = getRouteDetail(selectedBookingData?.route_id);

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-gradient-to-b from-[#F0F9FA] to-[#E6F7F9]">
        <Header />
        <NotificationToastContainer />
        <div className="flex">
          <Sidebar role="ADMIN" />
          <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto">

            {/* Banner */}
            <div id="overview" className="rtms-card p-6 bg-gradient-to-r from-[#142834] via-[#0F4C5C] to-[#71C9CE] text-white flex items-center justify-between shadow-xl scroll-mt-20">
              <div>
                <span className="px-3 py-1 bg-cyan-powder/20 text-cyan-powder border border-cyan-powder/30 rounded-full text-xs font-bold">
                  Điều hành viên: {user?.userName} ({user?.userEmail})
                </span>
                <h2 className="font-heading font-extrabold text-2xl mt-2 text-white">
                  Trung Tâm Điều Hành & Giám Sát Vận Tải Thủy ⚡
                </h2>
                <p className="text-xs text-gray-200 mt-1 max-w-2xl">
                  Theo dõi luồng vận chuyển, tình trạng đội tàu, mạng lưới cảng bến thủy nội địa và thực hiện điều phối vận hành toàn hệ thống.
                </p>
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="btn-primary text-xs px-4 py-2.5 bg-white text-slate-navy hover:bg-cyan-powder disabled:opacity-50 font-bold flex items-center gap-1.5 shadow-md"
              >
                <span>🔄</span>
                <span>{loading ? "Đang tải..." : "Cập Nhật Dữ Liệu"}</span>
              </button>
            </div>

            {/* System KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Tổng Đơn Vận Chuyển",  value: bookings.length,  icon: "📋", color: "border-l-ocean-teal", sub: `${statsActive} đang xử lý / ${statsFailed} hủy` },
                { label: "Đang Trên Tuyến",       value: statsInProgress,  icon: "🚢", color: "border-l-emerald-500", sub: `${statsCompleted} đã giao hàng` },
                { label: "Mạng Lưới Cảng",        value: ports.length,    icon: "⚓", color: "border-l-amber-500",   sub: "Cảng thủy nội địa" },
                { label: "Tổng Số Phương Tiện",   value: vessels.length,  icon: "🚤", color: "border-l-cyan-500",    sub: `${vessels.filter(v => v.vessel_status === "ACTIVE").length} tàu sẵn sàng` },
              ].map(kpi => (
                <div key={kpi.label} className={`rtms-card p-4 bg-white flex items-center justify-between border-l-4 ${kpi.color}`}>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase">{kpi.label}</p>
                    <h4 className="font-heading font-extrabold text-2xl text-slate-navy mt-0.5">{kpi.value}</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
                  </div>
                  <span className="text-3xl">{kpi.icon}</span>
                </div>
              ))}
            </div>

            {/* Error state */}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold">Lỗi tải dữ liệu điều hành</p>
                  <p className="text-xs mt-0.5">{error}</p>
                </div>
                <button onClick={fetchData} className="ml-auto px-3 py-1.5 rounded-lg border border-red-300 text-xs font-bold hover:bg-red-100">Thử lại</button>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════════════════════
                SECTION 1: BẢNG GIÁM SÁT ĐƠN HÀNG (TRỰC DIỆN, THOÁNG ĐÃNG)
            ══════════════════════════════════════════════════════════════════════════════════════════ */}
            <div id="bookings-monitor" className="rtms-card p-6 space-y-4 scroll-mt-20">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-navy flex items-center gap-2">
                    <span>📋</span>
                    <span>Danh Sách Đơn Vận Chuyển Toàn Hệ Thống ({bookings.length})</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Click vào nút &quot;🔍 Xem Chi Tiết&quot; ở mỗi đơn hàng để mở cửa sổ Overlay theo dõi tiến trình và điều phối.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1.5 flex-wrap items-center">
                  {[
                    { key: "ALL",         label: `Tất Cả (${bookings.length})` },
                    { key: "ACTIVE",      label: `Đang Xử Lý (${statsActive})` },
                    { key: "IN_PROGRESS", label: `Vận Chuyển (${statsInProgress})` },
                    { key: "COMPLETED",   label: `Hoàn Thành (${statsCompleted})` },
                    { key: "FAILED",      label: `Đã Hủy (${statsFailed})` },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setBookingFilter(f.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        bookingFilter === f.key
                          ? "bg-deep-teal text-white border-deep-teal shadow-xs"
                          : "bg-white text-gray-600 border-gray-200 hover:border-ocean-teal"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-aqua-soft">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-aqua-soft bg-cyan-powder/40 text-deep-teal font-bold">
                      <th className="py-3 px-3.5">Mã Đơn</th>
                      <th className="py-3 px-3">Loại Hàng</th>
                      <th className="py-3 px-3">Tải Trọng</th>
                      <th className="py-3 px-3">Hành Trình Tuyến (Điểm Đi ➔ Điểm Đến)</th>
                      <th className="py-3 px-3">Ngày Nhận</th>
                      <th className="py-3 px-3">Trạng Thái</th>
                      <th className="py-3 px-3.5 text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aqua-soft/40">
                    {getFilteredBookings().map(b => {
                      const routeInfo = getRouteDetail(b.route_id);

                      return (
                        <tr
                          key={b.booking_id}
                          onClick={() => handleOpenDetail(b.booking_id)}
                          className="hover:bg-cyan-powder/20 transition-all cursor-pointer"
                        >
                          <td className="py-3.5 px-3.5 font-bold text-slate-navy">
                            #{b.booking_id}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-slate-navy">{b.cargo_type}</td>
                          <td className="py-3.5 px-3 font-bold text-deep-teal">{b.cargo_capacity} tấn</td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-navy">
                              <span>📍 {routeInfo.departurePort}</span>
                              <span className="text-gray-400 mx-1.5">➔</span>
                              <span>🏁 {routeInfo.destinationPort}</span>
                            </div>
                            <span className="text-[10px] text-gray-400">({routeInfo.distanceKm} km)</span>
                          </td>
                          <td className="py-3.5 px-3 text-gray-500">{new Date(b.receive_date).toLocaleDateString("vi-VN")}</td>
                          <td className="py-3.5 px-3"><StatusBadge status={b.booking_status} /></td>
                          <td className="py-3.5 px-3.5 text-center">
                            <button
                              onClick={e => { e.stopPropagation(); handleOpenDetail(b.booking_id); }}
                              className="px-3.5 py-1.5 text-xs rounded-xl font-bold bg-deep-teal text-white hover:bg-slate-navy shadow-xs transition-all flex items-center gap-1 mx-auto"
                            >
                              <span>🔍</span>
                              <span>Xem Chi Tiết</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {getFilteredBookings().length === 0 && (
                  <div className="py-8 text-center text-gray-400 text-xs">Không có đơn hàng nào ở bộ lọc này.</div>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════════════════════
                SECTION 2: ĐIỀU PHỐI HỆ THỐNG CHUNG & ĐÔN ĐỐC TOÀN CỤC
            ══════════════════════════════════════════════════════════════════════════════════════════ */}
            <div id="job-triggers" className="rtms-card p-6 scroll-mt-20 space-y-4">
              <div className="flex items-center justify-between border-b border-aqua-soft pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-navy flex items-center gap-2">
                    <span>⚡</span>
                    <span>Công Cụ Điều Phối & Đôn Đốc Vận Hành Toàn Hệ Thống</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Thực hiện quét gom tàu theo timeout 24h, giải phóng đơn quá hạn hoặc kiểm tra nhật ký điều phối.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleTriggerJob("vessel-timeout")}
                  className="p-3.5 rounded-2xl border-2 border-aqua-soft bg-cyan-powder/20 hover:border-ocean-teal hover:bg-cyan-powder/40 transition-all text-left space-y-1"
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-navy">
                    <span>🛑</span>
                    <span>Gom Tàu Đồng Ý (Timeout 24h)</span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Tự động chuyển các đơn có ≥1 tàu đồng ý sang trạng thái để khách hàng chọn tàu.
                  </p>
                </button>

                <button
                  onClick={() => handleTriggerJob("booking-expired")}
                  className="p-3.5 rounded-2xl border-2 border-aqua-soft bg-cyan-powder/20 hover:border-ocean-teal hover:bg-cyan-powder/40 transition-all text-left space-y-1"
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-navy">
                    <span>⏳</span>
                    <span>Xử Lý Đơn Quá Hạn Tiếp Nhận</span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Đóng các yêu cầu ghép chuyến quá hạn tiếp nhận để giải phóng phương tiện.
                  </p>
                </button>

                <button
                  onClick={fetchData}
                  className="p-3.5 rounded-2xl border-2 border-aqua-soft bg-cyan-powder/20 hover:border-ocean-teal hover:bg-cyan-powder/40 transition-all text-left space-y-1"
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-navy">
                    <span>🔄</span>
                    <span>Đồng Bộ Trạng Thái Hệ Thống</span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Làm mới toàn bộ danh mục đơn, tàu, cảng và người dùng mới nhất từ PostgreSQL.
                  </p>
                </button>
              </div>

              {eventLogs.length > 0 && (
                <div className="pt-2 border-t border-aqua-soft space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-navy">📋 Nhật ký điều phối:</p>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {eventLogs.map(log => (
                      <div key={log.id} className="p-2 rounded-xl bg-slate-900 text-[10px] font-mono text-gray-300 flex items-center gap-2">
                        <span className="text-gray-400">[{log.timestamp}]</span>
                        <span className="text-cyan-400 font-bold">{log.event}</span>
                        {log.booking_id && <span className="text-yellow-400">#{log.booking_id}</span>}
                        <span className="text-gray-300 ml-auto">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════════════════════
                SECTION 3: QUẢN LÝ DANH MỤC HỆ THỐNG (ĐỘI TÀU, CẢNG BẾN & THÀNH VIÊN)
            ══════════════════════════════════════════════════════════════════════════════════════════ */}
            <div id="data-management" className="rtms-card p-6 scroll-mt-20 space-y-4">
              <div className="flex items-center justify-between border-b border-aqua-soft pb-3 flex-wrap gap-3">
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-navy flex items-center gap-2">
                    <span>👥</span>
                    <span>Danh Mục Quản Trị Hệ Thống</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Quản lý danh mục phương tiện tàu, mạng lưới cảng bến và các tài khoản thành viên trong hệ thống.
                  </p>
                </div>

                {/* Tab Buttons */}
                <div className="flex gap-2">
                  {[
                    { key: "vessels", label: `🚢 Đội Tàu (${vessels.length})` },
                    { key: "ports",   label: `⚓ Cảng Bến (${ports.length})` },
                    { key: "users",   label: `👥 Thành Viên (${users.length})` },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === tab.key
                          ? "bg-deep-teal text-white shadow-xs"
                          : "bg-cyan-powder/20 text-slate-navy hover:bg-cyan-powder/50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Vessels Tab ── */}
              {activeTab === "vessels" && (
                <div className="overflow-x-auto rounded-2xl border border-aqua-soft">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-aqua-soft bg-cyan-powder/40 text-deep-teal font-bold">
                        <th className="py-3 px-3.5">Mã Tàu</th>
                        <th className="py-3 px-3">Tên Chủ Tàu / Phương Tiện</th>
                        <th className="py-3 px-3">Sức Chứa (Tấn)</th>
                        <th className="py-3 px-3">Loại Hàng Chở</th>
                        <th className="py-3 px-3">Trạng Thái</th>
                        <th className="py-3 px-3.5">Chủ Sở Hữu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aqua-soft/40">
                      {vessels.map(v => (
                        <tr key={v.vessel_id} className="hover:bg-cyan-powder/20">
                          <td className="py-3 px-3.5 font-bold text-slate-navy">#{v.vessel_id}</td>
                          <td className="py-3 px-3 font-semibold">{v.vessel_owner_name}</td>
                          <td className="py-3 px-3 font-bold text-deep-teal">{v.vessel_capacity} tấn</td>
                          <td className="py-3 px-3 text-gray-600">{v.vessel_cargo_type}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              v.vessel_status === "ACTIVE"
                                ? "bg-green-100 text-green-800 border border-green-300"
                                : "bg-gray-100 text-gray-500 border border-gray-300"
                            }`}>{v.vessel_status === "ACTIVE" ? "Sẵn sàng" : "Tạm ngưng"}</span>
                          </td>
                          <td className="py-3 px-3.5 text-gray-500 font-medium">Chủ tàu #{v.user_id}</td>
                        </tr>
                      ))}
                      {vessels.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-gray-400">Không có dữ liệu phương tiện.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Ports Tab ── */}
              {activeTab === "ports" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ports.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center col-span-2">Không có dữ liệu cảng.</p>
                  ) : ports.map(p => (
                    <div key={p.port_id} className="p-4 rounded-2xl border border-aqua-soft bg-cyan-powder/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-heading font-bold text-sm text-slate-navy">⚓ {p.port_name}</span>
                          <p className="text-[11px] text-gray-500 mt-0.5">Cảng #{p.port_id} | Quản lý: Ban QL #{p.user_id}</p>
                        </div>
                        <span className="font-mono text-[11px] text-deep-teal bg-white px-2.5 py-1 rounded-md border border-aqua-soft">
                          Tọa độ: [{p.port_geo?.coordinates?.[0]}, {p.port_geo?.coordinates?.[1]}]
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Users Tab ── */}
              {activeTab === "users" && (
                <div className="overflow-x-auto rounded-2xl border border-aqua-soft">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-aqua-soft bg-cyan-powder/40 text-deep-teal font-bold">
                        <th className="py-3 px-3.5">Mã TV</th>
                        <th className="py-3 px-3">Tên Người Dùng</th>
                        <th className="py-3 px-3">Email Liên Hệ</th>
                        <th className="py-3 px-3">Số Điện Thoại</th>
                        <th className="py-3 px-3">Vai Trò</th>
                        <th className="py-3 px-3.5">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aqua-soft/40">
                      {users.map(u => {
                        const roleNames: Record<number, string> = {
                          1: "Quản trị viên",
                          2: "Khách hàng",
                          3: "Quản lý cảng",
                          4: "Chủ tàu",
                        };

                        return (
                          <tr key={u.user_id} className="hover:bg-cyan-powder/20">
                            <td className="py-3 px-3.5 font-bold text-slate-navy">#{u.user_id}</td>
                            <td className="py-3 px-3 font-semibold">{u.user_name}</td>
                            <td className="py-3 px-3 text-gray-600 font-mono text-[11px]">{u.user_email}</td>
                            <td className="py-3 px-3 text-gray-500">{u.user_phone || "—"}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-powder text-deep-teal border border-aqua-soft">
                                {roleNames[u.role_id] || `Vai trò #${u.role_id}`}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.user_status === "ACTIVE"
                                  ? "bg-green-100 text-green-800 border border-green-300"
                                  : "bg-gray-100 text-gray-500 border border-gray-300"
                              }`}>{u.user_status === "ACTIVE" ? "Hoạt động" : "Tạm khóa"}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {users.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-gray-400">Không có dữ liệu thành viên.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════════════════════
            OVERLAY MODAL: CHI TIẾT TIẾN TRÌNH & ĐIỀU PHỐI ĐƠN HÀNG
        ══════════════════════════════════════════════════════════════════════════════════════════ */}
        {showDetailModal && selectedBookingId && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border-2 border-aqua-soft space-y-5 p-6 animate-in fade-in zoom-in duration-150"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-aqua-soft pb-4">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-cyan-powder/40 rounded-2xl text-xl">🔍</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-extrabold text-xl text-slate-navy">
                        Chi Tiết Đơn Vận Tải #{selectedBookingId}
                      </h3>
                      {selectedBookingData && (
                        <StatusBadge status={selectedBookingData.booking_status} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Theo dõi trạng thái State Machine, các bên tham gia và điều phối xử lý.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-base transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              {loadingSnapshot ? (
                <div className="py-16 text-center text-gray-500 text-sm flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-ocean-teal border-t-transparent rounded-full animate-spin" />
                  <span>Đang tải tiến trình chi tiết của đơn hàng #{selectedBookingId}...</span>
                </div>
              ) : !workflowSnapshot ? (
                <div className="py-12 text-center text-gray-400 text-xs bg-cyan-powder/20 rounded-2xl border border-aqua-soft">
                  Không thể nạp thông tin snapshot cho đơn hàng #{selectedBookingId}.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column (2/3): Workflow Snapshot & Trip Info */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Status Highlights */}
                    <div className="p-4 rounded-2xl border border-aqua-soft bg-cyan-powder/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase block">Trạng Thái Đơn</span>
                        <StatusBadge status={workflowSnapshot.booking_status} />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase block">Bước Xử Lý</span>
                        <span className="font-extrabold text-slate-navy">{workflowSnapshot.current_step || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase block">Phê Duyệt Cảng</span>
                        <span className="font-bold text-emerald-600">
                          {workflowSnapshot.state_machine_data?.approved_port_reviews ?? 0}
                          /{workflowSnapshot.state_machine_data?.total_port_reviews ?? 0} Cảng Đã Duyệt
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase block">Tàu Nhận Chuyến</span>
                        <span className="font-bold text-blue-600">
                          {workflowSnapshot.state_machine_data?.accepted_vessel_matches ?? 0} Phương Tiện Đồng Ý
                        </span>
                      </div>
                    </div>

                    {/* Trip Parameters */}
                    <div className="border border-aqua-soft rounded-2xl p-4 bg-white space-y-3">
                      <h4 className="font-bold text-xs text-slate-navy uppercase tracking-wider">Thông Số Chuyến Vận Tải:</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-cyan-powder/20">
                          <span className="text-[10px] text-gray-500 block font-semibold">Loại Hàng Hóa</span>
                          <strong className="text-slate-navy text-sm">{selectedBookingData?.cargo_type || "—"}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-cyan-powder/20">
                          <span className="text-[10px] text-gray-500 block font-semibold">Tải Trọng Chở</span>
                          <strong className="text-deep-teal text-sm">{selectedBookingData?.cargo_capacity ? `${selectedBookingData.cargo_capacity} tấn` : "—"}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-cyan-powder/20">
                          <span className="text-[10px] text-gray-500 block font-semibold">Cự Ly Tuyến Sông</span>
                          <strong className="text-slate-navy text-sm">{selectedRouteInfo?.distanceKm ? `${selectedRouteInfo.distanceKm} km` : "—"}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                          <span className="text-[10px] text-gray-500 block font-semibold">📍 Cảng Đi (Bốc Hàng)</span>
                          <strong className="text-deep-teal">{selectedRouteInfo?.departurePort || "—"}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                          <span className="text-[10px] text-gray-500 block font-semibold">🏁 Cảng Đến (Dỡ Hàng)</span>
                          <strong className="text-deep-teal">{selectedRouteInfo?.destinationPort || "—"}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-cyan-powder/20">
                          <span className="text-[10px] text-gray-500 block font-semibold">Chủ Hàng (Khách Đặt)</span>
                          <span className="font-bold text-slate-navy">{selectedBookingData?.user_id ? `Khách hàng #${selectedBookingData.user_id}` : "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* 6 Step Progress Indicator */}
                    <div className="p-4 rounded-2xl border border-aqua-soft bg-cyan-powder/10 space-y-2">
                      <h4 className="font-bold text-xs text-slate-navy">Tiến Trình 6 Bước:</h4>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        {[
                          { label: "1. Đặt Chuyến", done: true },
                          { label: "2. Duyệt 2 Cảng", done: (workflowSnapshot.state_machine_data?.approved_port_reviews ?? 0) >= 2 },
                          { label: "3. Tàu Phản Hồi", done: (workflowSnapshot.state_machine_data?.accepted_vessel_matches ?? 0) >= 1 },
                          { label: "4. Khách Chọn Tàu", done: ["WAITING_FINAL_CONFIRMATION","CONFIRMED","IN_PROGRESS","COMPLETED"].includes(workflowSnapshot.booking_status) },
                          { label: "5. Cảng Ký Cuối", done: ["CONFIRMED","IN_PROGRESS","COMPLETED"].includes(workflowSnapshot.booking_status) },
                          { label: "6. Vận Chuyển", done: ["IN_PROGRESS","COMPLETED"].includes(workflowSnapshot.booking_status) },
                        ].map((st, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                              st.done ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-gray-100 text-gray-500"
                            }`}>
                              {st.done ? "✓ " : ""}{st.label}
                            </span>
                            {i < 5 && <span className="text-gray-300 text-xs">→</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column (1/3): Operations & Dispatching for this booking */}
                  <div className="space-y-4 border-l border-aqua-soft pl-0 lg:pl-6">
                    <div className="space-y-1">
                      <h4 className="font-heading font-extrabold text-sm text-slate-navy flex items-center gap-2">
                        <span>⚡</span>
                        <span>Điều Phối Cho Đơn #{selectedBookingId}</span>
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Thực hiện gửi nhắc nhở hoặc các thao tác điều hành tức thì.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-cyan-powder/30 border border-aqua-soft space-y-2">
                      <label className="text-[11px] font-extrabold text-slate-navy block">Nội dung đôn đốc nhắc nhở:</label>
                      <select
                        value={reminderContext}
                        onChange={e => setReminderContext(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-aqua-soft text-xs font-semibold bg-white focus:outline-none"
                      >
                        {REMINDER_CONTEXTS.map(rc => <option key={rc.value} value={rc.value}>{rc.label}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        onClick={() => handleTriggerJob("send-reminder")}
                        className="w-full btn-primary text-xs py-2.5 shadow-sm font-bold flex items-center justify-center gap-1.5"
                      >
                        <span>🔔</span>
                        <span>Gửi Thông Báo Đôn Đốc</span>
                      </button>
                      <button
                        onClick={() => handleTriggerJob("vessel-timeout")}
                        className="w-full btn-secondary text-xs py-2.5 justify-start font-semibold flex items-center gap-2"
                      >
                        <span>🛑</span>
                        <span>Gom Tàu Đồng Ý (Timeout 24h)</span>
                      </button>
                      <button
                        onClick={() => handleTriggerJob("booking-expired")}
                        className="w-full btn-secondary text-xs py-2.5 justify-start font-semibold flex items-center gap-2"
                      >
                        <span>⏳</span>
                        <span>Xử Lý Quá Hạn Tiếp Nhận</span>
                      </button>
                      <button
                        onClick={handlePublishEvent}
                        className="w-full btn-secondary text-xs py-2.5 justify-start font-semibold flex items-center gap-2"
                      >
                        <span>📡</span>
                        <span>Phát Thông Báo Khẩn</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="border-t border-aqua-soft pt-4 flex justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-navy text-white text-xs font-bold hover:bg-slate-navy/90 shadow-sm transition-all"
                >
                  Đóng Cửa Sổ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
