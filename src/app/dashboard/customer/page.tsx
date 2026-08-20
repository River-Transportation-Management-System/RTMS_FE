"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationToastContainer } from "@/components/common/NotificationToast";
import { setActiveActor } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  cancelBooking,
  createBooking,
  getBooking,
  getBookingVesselRequests,
  listBookings,
  listCargoTypes,
  listPortReviews,
  selectVessel,
} from "@/lib/services/booking.service";
import { customerSelectedWorkflow } from "@/lib/services/workflow.service";
import { realtimeHub } from "@/lib/realtime";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ROUTES_LIST, formatRouteLabel, getRouteDetail } from "@/lib/routes";

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING_PORT_REVIEW:        { label: "Chờ Cảng Duyệt",       cls: "bg-amber-100 text-amber-800 border border-amber-300" },
  WAITING_VESSEL_RESPONSE:    { label: "Chờ Tàu Phản Hồi",      cls: "bg-blue-100 text-blue-800 border border-blue-300" },
  VESSEL_CANDIDATES_READY:    { label: "Có Tàu Nhận Chuyến",   cls: "bg-cyan-100 text-cyan-800 border border-cyan-300" },
  WAITING_CUSTOMER_SELECTION: { label: "Mời Bạn Chọn Tàu",      cls: "bg-purple-100 text-purple-800 border border-purple-300" },
  WAITING_FINAL_CONFIRMATION: { label: "Chờ Xác Nhận Cuối",     cls: "bg-orange-100 text-orange-800 border border-orange-300" },
  CONFIRMED:                  { label: "Đã Xác Nhận",           cls: "bg-green-100 text-green-800 border border-green-300" },
  IN_PROGRESS:                { label: "Đang Vận Chuyển",       cls: "bg-emerald-100 text-emerald-800 border border-emerald-300" },
  COMPLETED:                  { label: "Hoàn Thành",            cls: "bg-teal-100 text-teal-800 border border-teal-300" },
  REJECTED_BY_PORT:           { label: "Cảng Từ Chối",          cls: "bg-red-100 text-red-800 border border-red-300" },
  INVALID_ROUTE:              { label: "Tuyến Không Hợp Lệ",    cls: "bg-red-100 text-red-700 border border-red-300" },
  NO_VESSEL_AVAILABLE:        { label: "Không Có Tàu Phù Hợp",  cls: "bg-rose-100 text-rose-800 border border-rose-300" },
  NO_VESSEL_ACCEPTED:         { label: "Không Tàu Nào Nhận",    cls: "bg-rose-100 text-rose-700 border border-rose-300" },
  EXPIRED:                    { label: "Hết Hạn",               cls: "bg-gray-100 text-gray-600 border border-gray-300" },
  CANCELLED:                  { label: "Đã Hủy",                cls: "bg-gray-100 text-gray-500 border border-gray-300" },
  FAILED:                     { label: "Thất Bại",              cls: "bg-red-100 text-red-900 border border-red-300" },
};

const WORKFLOW_STEPS = [
  { key: "PENDING_PORT_REVIEW",        label: "Cảng Duyệt",   icon: "⚓" },
  { key: "WAITING_VESSEL_RESPONSE",    label: "Tàu Phản Hồi", icon: "📡" },
  { key: "WAITING_CUSTOMER_SELECTION", label: "Bạn Chọn Tàu", icon: "🚤" },
  { key: "WAITING_FINAL_CONFIRMATION", label: "XN Cuối",       icon: "📜" },
  { key: "IN_PROGRESS",                label: "Vận Chuyển",   icon: "🚢" },
  { key: "COMPLETED",                  label: "Hoàn Thành",   icon: "✅" },
];

const STATUS_ORDER: Record<string, number> = {
  PENDING_PORT_REVIEW: 0,
  WAITING_VESSEL_RESPONSE: 1,
  VESSEL_CANDIDATES_READY: 2, WAITING_CUSTOMER_SELECTION: 2,
  WAITING_FINAL_CONFIRMATION: 3,
  CONFIRMED: 4, IN_PROGRESS: 4,
  COMPLETED: 5,
};

const ERROR_STATUSES = ["REJECTED_BY_PORT","INVALID_ROUTE","NO_VESSEL_AVAILABLE","NO_VESSEL_ACCEPTED","EXPIRED","CANCELLED","FAILED"];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: "bg-gray-100 text-gray-600 border border-gray-300" };
  return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

function WorkflowStepBar({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER[status] ?? -1;
  const isError = ERROR_STATUSES.includes(status);
  return (
    <div className="flex items-center gap-1 mt-2">
      {WORKFLOW_STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div title={s.label} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
            ${isError && i === currentIdx ? "bg-rose-500 text-white" :
              i < currentIdx ? "bg-ocean-teal text-slate-navy font-black" :
              i === currentIdx ? "bg-deep-teal text-white ring-2 ring-deep-teal ring-offset-1" :
              "bg-gray-100 text-gray-400 border border-gray-200"}`}>
            {i < currentIdx ? "✓" : isError && i === currentIdx ? "✕" : s.icon}
          </div>
          {i < WORKFLOW_STEPS.length - 1 && (
            <div className={`h-0.5 w-3.5 ${i < currentIdx ? "bg-ocean-teal" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();

  const [bookings, setBookings] = useState<any[]>([]);
  const [cargoTypes, setCargoTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVesselModal, setShowVesselModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Selected booking data
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [detailBooking, setDetailBooking] = useState<any | null>(null);
  const [vesselRequests, setVesselRequests] = useState<any[]>([]);
  const [portReviews, setPortReviews] = useState<any[]>([]);
  const [selectingVessel, setSelectingVessel] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filter
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Form
  const [form, setForm] = useState({
    route_id: 1,
    cargo_type: "",
    cargo_capacity: 200,
    receive_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    expected_date: new Date(Date.now() + 86400000 * 4).toISOString().split("T")[0],
    notes: "",
  });

  const currentUserId = user?.userId || 2;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (user) {
        setActiveActor(user.userId, user.roleCode);
      }

      const [bRes, cRes]: any[] = await Promise.all([
        listBookings({ page: 1, limit: 50, user_id: currentUserId }),
        listCargoTypes(),
      ]);

      const bItems: any[] = bRes?.data?.items ?? [];
      const cItems: any[] = cRes?.data?.items ?? [];

      setBookings(bItems);
      setCargoTypes(cItems);

      if (cItems.length > 0 && !form.cargo_type) {
        setForm(f => ({ ...f, cargo_type: cItems[0] }));
      }
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || "Không thể tải danh sách đơn hàng";
      setError(msg);
      console.error("[Customer] fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, user, form.cargo_type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: any = await createBooking({
        user_id: currentUserId,
        route_id: Number(form.route_id),
        cargo_type: form.cargo_type,
        cargo_capacity: Number(form.cargo_capacity),
        receive_date: new Date(form.receive_date).toISOString(),
        expected_date: new Date(form.expected_date).toISOString(),
        notes: form.notes,
      });

      const routeInfo = getRouteDetail(form.route_id);
      realtimeHub.notify({
        title: "✅ Tạo Đơn Đặt Chuyến thành công!",
        message: `Đơn #${res.data?.booking_id} (${routeInfo.departurePort} ➔ ${routeInfo.destinationPort}) đã khởi tạo. Yêu cầu đã chuyển tới 2 Cảng kiểm duyệt!`,
        type: "success",
        roleTarget: "PORT_MANAGER",
      });

      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      alert("Lỗi tạo đơn: " + (err.error?.message || err.message || "Lỗi thao tác"));
    }
  };

  const handleOpenVesselModal = async (booking: any) => {
    setSelectedBooking(booking);
    setVesselRequests([]);
    setShowVesselModal(true);
    try {
      const res: any = await getBookingVesselRequests(booking.booking_id);
      setVesselRequests(res?.data?.items ?? []);
    } catch (err) {
      console.error("[Customer] vessel requests error:", err);
    }
  };

  const handleOpenDetailModal = async (booking: any) => {
    setDetailBooking(booking);
    setPortReviews([]);
    setVesselRequests([]);
    setShowDetailModal(true);
    setLoadingDetail(true);
    try {
      const [bRes, prRes, vrRes]: any[] = await Promise.all([
        getBooking(booking.booking_id),
        listPortReviews(booking.booking_id),
        getBookingVesselRequests(booking.booking_id),
      ]);
      setDetailBooking(bRes?.data ?? booking);
      setPortReviews(prRes?.data?.items ?? []);
      setVesselRequests(vrRes?.data?.items ?? []);
    } catch (err) {
      console.error("[Customer] detail load error:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSelectVessel = async (matchId: number, vesselId: number) => {
    if (!selectedBooking) return;
    setSelectingVessel(true);
    try {
      await selectVessel(selectedBooking.booking_id, {
        match_id: matchId,
        selected_vessel_id: vesselId,
        selection_note: "Khách chốt chọn tàu từ giao diện Web",
      });

      await customerSelectedWorkflow({
        booking_id: selectedBooking.booking_id,
        selected_vessel_id: vesselId,
      });

      realtimeHub.notify({
        title: "🚢 Chốt Tàu thành công!",
        message: `Đơn #${selectedBooking.booking_id} đang chờ 2 Cảng xác nhận hợp đồng vận chuyển cuối!`,
        type: "success",
        roleTarget: "PORT_MANAGER",
      });

      setShowVesselModal(false);
      fetchData();
    } catch (err: any) {
      alert("Lỗi chốt chọn tàu: " + (err.error?.message || err.message || "Lỗi thao tác"));
    } finally {
      setSelectingVessel(false);
    }
  };

  const handleCancelBooking = async (id: number) => {
    if (!confirm(`Bạn có chắc muốn hủy đơn #${id}?`)) return;
    try {
      await cancelBooking(id);
      realtimeHub.notify({
        title: "Đã hủy đơn chuyến",
        message: `Đơn #${id} đã được chuyển sang trạng thái ĐÃ HỦY`,
        type: "warning",
      });
      fetchData();
    } catch (err: any) {
      alert("Lỗi hủy đơn: " + (err.error?.message || err.message || "Lỗi thao tác"));
    }
  };

  const TAB_FILTERS = [
    { key: "ALL",            label: "Tất Cả" },
    { key: "ACTIVE",         label: "Đang Xử Lý" },
    { key: "WAITING_VESSEL", label: "⏳ Chờ Tàu Phản Hồi" },
    { key: "ACTION",         label: "⚡ Cần Chọn Tàu" },
    { key: "IN_PROGRESS",    label: "🚢 Vận Chuyển" },
    { key: "COMPLETED",      label: "✅ Hoàn Thành" },
    { key: "FAILED",         label: "❌ Đã Hủy" },
  ];

  const getFilteredBookings = () => {
    switch (filterStatus) {
      case "ACTIVE":         return bookings.filter(b => ["PENDING_PORT_REVIEW","WAITING_VESSEL_RESPONSE","VESSEL_CANDIDATES_READY","WAITING_CUSTOMER_SELECTION","WAITING_FINAL_CONFIRMATION","CONFIRMED"].includes(b.booking_status));
      case "WAITING_VESSEL": return bookings.filter(b => b.booking_status === "WAITING_VESSEL_RESPONSE");
      case "ACTION":         return bookings.filter(b => ["WAITING_CUSTOMER_SELECTION","VESSEL_CANDIDATES_READY"].includes(b.booking_status));
      case "IN_PROGRESS":    return bookings.filter(b => b.booking_status === "IN_PROGRESS");
      case "COMPLETED":      return bookings.filter(b => b.booking_status === "COMPLETED");
      case "FAILED":         return bookings.filter(b => ERROR_STATUSES.includes(b.booking_status));
      default:               return bookings;
    }
  };
  const filteredBookings = getFilteredBookings();

  const tabCount = (key: string) => {
    switch (key) {
      case "ALL":            return bookings.length;
      case "ACTIVE":         return bookings.filter(b => ["PENDING_PORT_REVIEW","WAITING_VESSEL_RESPONSE","VESSEL_CANDIDATES_READY","WAITING_CUSTOMER_SELECTION","WAITING_FINAL_CONFIRMATION","CONFIRMED"].includes(b.booking_status)).length;
      case "WAITING_VESSEL": return bookings.filter(b => b.booking_status === "WAITING_VESSEL_RESPONSE").length;
      case "ACTION":         return bookings.filter(b => ["WAITING_CUSTOMER_SELECTION","VESSEL_CANDIDATES_READY"].includes(b.booking_status)).length;
      case "IN_PROGRESS":    return bookings.filter(b => b.booking_status === "IN_PROGRESS").length;
      case "COMPLETED":      return bookings.filter(b => b.booking_status === "COMPLETED").length;
      case "FAILED":         return bookings.filter(b => ERROR_STATUSES.includes(b.booking_status)).length;
      default:               return 0;
    }
  };

  const isSelectionReady = selectedBooking && ["WAITING_CUSTOMER_SELECTION", "VESSEL_CANDIDATES_READY"].includes(selectedBooking.booking_status);
  const isWaitingVessel = selectedBooking && selectedBooking.booking_status === "WAITING_VESSEL_RESPONSE";
  const acceptedVessels = vesselRequests.filter(vr => vr.match_status === "ACCEPTED");

  return (
    <RoleGuard allowedRoles={["CUSTOMER"]}>
      <div className="min-h-screen bg-gradient-to-b from-[#F0F9FA] to-[#E6F7F9]">
        <Header />
        <NotificationToastContainer />
        <div className="flex">
          <Sidebar role="CUSTOMER" />
          <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto">

            {/* Banner */}
            <div id="overview" className="rtms-card p-6 bg-gradient-to-r from-[#71C9CE] via-[#A6E3E9] to-[#CBF1F5] text-slate-navy flex items-center justify-between shadow-md scroll-mt-20">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-white/80 rounded-full text-xs font-bold text-deep-teal shadow-xs">
                    Chủ hàng: {user?.userName} ({user?.userEmail})
                  </span>
                </div>
                <h2 className="font-heading font-extrabold text-2xl mt-2">
                  Quản lý Đặt Chuyến Vận Tải Đường Thủy 🌾🚢
                </h2>
                <p className="text-xs text-slate-navy/80 mt-1 max-w-2xl">
                  Tạo đơn hàng mới, theo dõi cảng bốc xếp kiểm duyệt, xem danh sách tàu ứng viên và chọn phương tiện nhận chuyến.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary bg-slate-navy text-white hover:bg-slate-navy/90 text-sm px-5 py-3 shadow-lg flex items-center gap-2"
              >
                <span>➕</span>
                <span>Tạo Đơn Đặt Chuyến Mới</span>
              </button>
            </div>

            {/* Workflow Steps Overview */}
            <div id="workflow-guide" className="rtms-card p-5 bg-white scroll-mt-20">
              <h3 className="font-heading font-bold text-sm text-slate-navy mb-3">📍 Quy trình Vận tải 6 Bước</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { icon: "📦", label: "1. Đặt Chuyến", sub: "Khởi tạo đơn hàng" },
                  { icon: "⚓", label: "2. 2 Cảng Duyệt", sub: "Cảng đi & đến" },
                  { icon: "📡", label: "3. Tàu Phản Hồi", sub: "Chờ tàu xác nhận" },
                  { icon: "🤝", label: "4. Bạn Chọn Tàu", sub: "Gom tàu đồng ý & Chọn" },
                  { icon: "📜", label: "5. Cảng XN Cuối", sub: "Ký kết hợp đồng" },
                  { icon: "✅", label: "6. Vận Chuyển", sub: "Bốc dỡ & Giao nhận" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="p-2.5 rounded-xl bg-cyan-powder/40 border border-aqua-soft text-center min-w-[95px]">
                      <div className="text-base">{s.icon}</div>
                      <h4 className="font-bold text-[10px] text-slate-navy leading-tight mt-0.5">{s.label}</h4>
                      <p className="text-[9px] text-deep-teal mt-0.5">{s.sub}</p>
                    </div>
                    {i < 5 && <span className="text-gray-300 font-bold">→</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Error state */}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold">Lỗi tải dữ liệu</p>
                  <p className="text-xs mt-0.5">{error}</p>
                </div>
                <button onClick={fetchData} className="ml-auto px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-100">
                  Thử lại
                </button>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap items-center">
              {TAB_FILTERS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                    filterStatus === tab.key
                      ? "bg-deep-teal text-white border-deep-teal shadow-xs"
                      : "bg-white text-gray-600 border-gray-200 hover:border-ocean-teal"
                  }`}
                >
                  {tab.label} ({tabCount(tab.key)})
                </button>
              ))}
              <button onClick={fetchData} className="ml-auto btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                <span>🔄</span>
                <span>Tải lại</span>
              </button>
            </div>

            {/* Bookings List */}
            <div id="bookings-list" className="rtms-card p-6 scroll-mt-20">
              <h3 className="font-heading font-bold text-lg text-slate-navy mb-4">
                📋 Danh sách Đơn đặt chuyến của bạn ({filteredBookings.length})
              </h3>

              {loading ? (
                <div className="py-16 text-center text-gray-500 text-sm flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-4 border-ocean-teal border-t-transparent rounded-full animate-spin" />
                  <span>Đang tải danh sách đơn hàng...</span>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">
                  {filterStatus === "ALL"
                    ? 'Chưa có đơn đặt chuyến nào. Nhấn "Tạo Đơn Đặt Chuyến Mới" để bắt đầu.'
                    : "Không có đơn nào ở trạng thái này."}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((b) => {
                    const routeInfo = getRouteDetail(b.route_id);
                    const canSelectNow = ["WAITING_CUSTOMER_SELECTION", "VESSEL_CANDIDATES_READY"].includes(b.booking_status);
                    const isWaitingVesselResponse = b.booking_status === "WAITING_VESSEL_RESPONSE";

                    return (
                      <div key={b.booking_id} className="p-5 rounded-2xl border border-aqua-soft bg-white hover:border-ocean-teal hover:shadow-md transition-all">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-heading font-extrabold text-base text-slate-navy">
                                Đơn #{b.booking_id}
                              </span>
                              <StatusBadge status={b.booking_status} />
                              
                              {/* Selection Ready Alert */}
                              {canSelectNow && (
                                <span className="px-2.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-extrabold animate-pulse shadow-xs">
                                  ⚡ Đã gom tàu nhận — Mời bạn chọn tàu
                                </span>
                              )}

                              {/* Waiting Vessel Notice */}
                              {isWaitingVesselResponse && (
                                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-bold">
                                  ⏳ Đang chờ các chủ tàu phản hồi (chưa mở chọn)
                                </span>
                              )}
                            </div>

                            {/* Clear Departure -> Destination Route Badge */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-powder/40 border border-aqua-soft text-xs">
                                <span className="font-bold text-deep-teal">📍 Điểm đi: {routeInfo.departurePort}</span>
                                <span className="text-gray-400 font-bold">➔</span>
                                <span className="font-bold text-deep-teal">🏁 Điểm đến: {routeInfo.destinationPort}</span>
                                {routeInfo.distanceKm && (
                                  <span className="text-[10px] font-semibold text-gray-500 ml-1">({routeInfo.distanceKm} km)</span>
                                )}
                              </span>
                            </div>

                            <p className="text-xs text-gray-600">
                              Loại hàng: <strong className="text-slate-navy">{b.cargo_type}</strong>{" "}
                              | Tải trọng: <strong className="text-deep-teal">{b.cargo_capacity} tấn</strong>
                            </p>
                            <p className="text-[11px] text-gray-400">
                              Ngày nhận: {new Date(b.receive_date).toLocaleDateString("vi-VN")}{" "}
                              | Ngày giao: {new Date(b.expected_date).toLocaleDateString("vi-VN")}
                              {b.notes ? ` | Ghi chú: ${b.notes}` : ""}
                            </p>
                            <WorkflowStepBar status={b.booking_status} />
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                            <button
                              onClick={() => handleOpenDetailModal(b)}
                              className="px-3 py-2 text-xs rounded-xl border border-aqua-soft text-deep-teal hover:bg-cyan-powder/30 font-bold transition-all"
                            >
                              🔍 Chi Tiết
                            </button>

                            {/* Action when in WAITING_VESSEL_RESPONSE: View Candidates Read-only */}
                            {isWaitingVesselResponse && (
                              <button
                                onClick={() => handleOpenVesselModal(b)}
                                className="px-3.5 py-2 text-xs rounded-xl border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold transition-all flex items-center gap-1"
                              >
                                <span>👁️</span>
                                <span>Xem Tàu Đang Liên Hệ</span>
                              </button>
                            )}

                            {/* Action when in WAITING_CUSTOMER_SELECTION: Select Vessel Active */}
                            {canSelectNow && (
                              <button
                                onClick={() => handleOpenVesselModal(b)}
                                className="btn-primary text-xs px-4 py-2 shadow-sm font-bold flex items-center gap-1"
                              >
                                <span>🚤</span>
                                <span>Chọn Tàu Nhận Chuyến</span>
                              </button>
                            )}

                            {["PENDING_PORT_REVIEW","WAITING_VESSEL_RESPONSE","VESSEL_CANDIDATES_READY","WAITING_CUSTOMER_SELECTION"].includes(b.booking_status) && (
                              <button
                                onClick={() => handleCancelBooking(b.booking_id)}
                                className="px-3 py-2 text-xs rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold transition-all"
                              >
                                Hủy Đơn
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>

        {/* ── Modal: Tạo Booking ─────────────────────────────── */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="rtms-card p-6 max-w-lg w-full bg-white rounded-3xl shadow-2xl border-2 border-aqua-soft space-y-5">
              <div className="flex items-center justify-between border-b border-aqua-soft pb-3">
                <h3 className="font-heading font-extrabold text-lg text-slate-navy flex items-center gap-2">
                  <span>➕</span>
                  <span>Tạo Đơn Đặt Chuyến Vận Tải Mới</span>
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-slate-navy font-bold text-lg">✕</button>
              </div>
              <form onSubmit={handleCreateBooking} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-gray-700 mb-1 font-bold">Tuyến đường vận chuyển (Điểm đi ➔ Điểm đến):</label>
                  <select
                    value={form.route_id}
                    onChange={e => setForm({ ...form, route_id: Number(e.target.value) })}
                    className="w-full p-3 rounded-xl border border-aqua-soft bg-cyan-powder/20 font-medium text-slate-navy focus:outline-none focus:border-ocean-teal text-xs"
                  >
                    {ROUTES_LIST.map(r => (
                      <option key={r.routeId} value={r.routeId}>
                        📍 {r.departurePort} ➔ 🏁 {r.destinationPort} ({r.distanceKm} km)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 mb-1 font-bold">Loại Hàng Hóa:</label>
                    <select
                      value={form.cargo_type}
                      onChange={e => setForm({ ...form, cargo_type: e.target.value })}
                      className="w-full p-3 rounded-xl border border-aqua-soft bg-cyan-powder/20 font-medium text-slate-navy focus:outline-none focus:border-ocean-teal"
                    >
                      {cargoTypes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 font-bold">Tải Trọng (Tấn):</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={form.cargo_capacity}
                      onChange={e => setForm({ ...form, cargo_capacity: Number(e.target.value) })}
                      className="w-full p-3 rounded-xl border border-aqua-soft bg-cyan-powder/20 font-bold text-deep-teal focus:outline-none focus:border-ocean-teal"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 mb-1 font-bold">Ngày Nhận Hàng:</label>
                    <input
                      type="date"
                      required
                      value={form.receive_date}
                      onChange={e => setForm({ ...form, receive_date: e.target.value })}
                      className="w-full p-3 rounded-xl border border-aqua-soft bg-cyan-powder/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 font-bold">Ngày Dự Kiến Giao:</label>
                    <input
                      type="date"
                      required
                      value={form.expected_date}
                      onChange={e => setForm({ ...form, expected_date: e.target.value })}
                      className="w-full p-3 rounded-xl border border-aqua-soft bg-cyan-powder/20 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 mb-1 font-bold">Ghi chú yêu cầu:</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="Yêu cầu bốc xếp hoặc ghi chú thêm..."
                    className="w-full p-3 rounded-xl border border-aqua-soft bg-cyan-powder/20 focus:outline-none"
                  />
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-700">
                  ℹ️ Đơn hàng sẽ được chuyển tới Cảng đi và Cảng đến để cùng kiểm duyệt đồng thời trước khi tìm kiếm phương tiện vận tải.
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-aqua-soft">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Hủy bỏ</button>
                  <button type="submit" className="btn-primary shadow-md font-bold">🚀 Tạo Đơn Hàng</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: Xem Tàu Đang Liên Hệ & Chọn Tàu Nhận Chuyến ── */}
        {showVesselModal && selectedBooking && (
          <div className="fixed inset-0 z-50 bg-slate-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="rtms-card p-6 max-w-xl w-full bg-white rounded-3xl shadow-2xl border-2 border-aqua-soft space-y-5">
              <div className="flex items-center justify-between border-b border-aqua-soft pb-3">
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-navy">
                    {isSelectionReady ? "🚢 Lựa Chọn Tàu Vận Chuyển" : "🔍 Danh Sách Tàu Phù Hợp Đang Liên Hệ"} — Đơn #{selectedBooking.booking_id}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Tuyến: <strong className="text-slate-navy">{formatRouteLabel(selectedBooking.route_id)}</strong>
                  </p>
                </div>
                <button onClick={() => setShowVesselModal(false)} className="text-gray-400 hover:text-slate-navy font-bold text-lg">✕</button>
              </div>

              {/* ── CASE 1: WAITING_VESSEL_RESPONSE (Chờ chủ tàu phản hồi - Khách hàng CHƯA ĐƯỢC CHỌN) ── */}
              {isWaitingVessel && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span>⏳</span>
                      <span>Đang chờ các chủ tàu phản hồi nhận chuyến:</span>
                    </div>
                    <p className="text-xs leading-relaxed pl-5 font-medium text-amber-800">
                      Cả 2 Cảng đã kiểm duyệt đạt điều kiện. Hệ thống đã gửi thông báo đến các chủ tàu đủ điều kiện bên dưới. <strong>Sau khi hết thời gian chờ phản hồi, hệ thống sẽ gom các tàu đồng ý để quý khách bắt đầu lựa chọn.</strong>
                    </p>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    <p className="text-[11px] font-bold text-slate-navy uppercase tracking-wider">
                      Danh sách phương tiện đang được liên hệ ({vesselRequests.length}):
                    </p>
                    {vesselRequests.length === 0 ? (
                      <div className="py-6 text-center text-gray-400 text-xs bg-cyan-powder/20 rounded-xl border border-aqua-soft">
                        Đang tìm kiếm các phương tiện phù hợp với tải trọng {selectedBooking.cargo_capacity} tấn...
                      </div>
                    ) : (
                      vesselRequests.map((vr: any) => (
                        <div key={vr.match_id} className="p-3.5 rounded-2xl border border-aqua-soft bg-cyan-powder/20 flex items-center justify-between">
                          <div>
                            <h4 className="font-heading font-bold text-sm text-slate-navy">
                              {vr.vessel_summary?.vessel_owner_name || `Tàu #${vr.vessel_id}`}
                            </h4>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Sức chứa: <strong className="text-deep-teal">{vr.vessel_summary?.vessel_capacity} tấn</strong>{" "}
                              | Chuyên chở: <strong>{vr.vessel_summary?.vessel_cargo_type}</strong>
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            vr.match_status === "ACCEPTED" ? "bg-green-100 text-green-800 border border-green-300"
                            : vr.match_status === "REJECTED" ? "bg-gray-100 text-gray-500 border border-gray-300"
                            : "bg-amber-100 text-amber-800 border border-amber-300"
                          }`}>
                            {vr.match_status === "ACCEPTED" ? "✅ Đã đồng ý nhận"
                             : vr.match_status === "REJECTED" ? "✕ Không nhận chuyến"
                             : "⏳ Đang chờ phản hồi"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── CASE 2: WAITING_CUSTOMER_SELECTION (Đã gom các tàu ACCEPTED - Khách hàng BẮT ĐẦU ĐƯỢC CHỌN) ── */}
              {isSelectionReady && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span>✅</span>
                      <span>Danh sách các tàu đã đồng ý nhận chuyến:</span>
                    </div>
                    <p className="text-xs leading-relaxed pl-5 font-medium text-emerald-800">
                      Quý khách vui lòng chọn 1 phương tiện vận tải dưới đây để tiến hành ký kết hợp đồng vận chuyển chính thức.
                    </p>
                  </div>

                  {acceptedVessels.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-xs bg-rose-50 rounded-2xl border border-rose-200 p-4 space-y-2">
                      <span className="text-2xl block">⚠️</span>
                      <p className="font-bold text-rose-800">Không có tàu nào đồng ý nhận chuyến trong đợt này</p>
                      <p className="text-rose-600">Vui lòng điều chỉnh lại ngày nhận hàng hoặc liên hệ trung tâm điều hành để tìm thêm phương tiện.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {acceptedVessels.map((vr: any) => (
                        <div key={vr.match_id} className="p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 flex items-center justify-between hover:bg-emerald-100/50 transition-all">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-heading font-bold text-sm text-slate-navy">
                                {vr.vessel_summary?.vessel_owner_name || `Tàu #${vr.vessel_id}`}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-100 text-green-800 border border-green-300">
                                Sẵn sàng vận chuyển
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Sức chứa: <strong className="text-deep-teal">{vr.vessel_summary?.vessel_capacity} tấn</strong>{" "}
                              | Chuyên chở: <strong>{vr.vessel_summary?.vessel_cargo_type}</strong>
                            </p>
                          </div>
                          <button
                            onClick={() => handleSelectVessel(vr.match_id, vr.vessel_id)}
                            disabled={selectingVessel}
                            className="btn-primary text-xs px-4 py-2 disabled:opacity-50 font-bold shadow-xs flex items-center gap-1.5"
                          >
                            {selectingVessel ? (
                              <span>⏳ Đang chốt...</span>
                            ) : (
                              <>
                                <span>✅</span>
                                <span>Chọn Tàu Này</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-[11px] text-purple-700">
                    📌 Sau khi chốt chọn tàu, đơn hàng sẽ được chuyển tới Ban Quản Lý Cảng để hoàn tất thủ tục xác nhận hợp đồng vận tải.
                  </div>
                </div>
              )}

              {/* ── CASE 3: Other states ── */}
              {!isWaitingVessel && !isSelectionReady && (
                <div className="py-6 text-center text-gray-500 text-xs bg-cyan-powder/20 rounded-xl border border-aqua-soft space-y-2">
                  <p>Trạng thái đơn hàng hiện tại: <strong className="text-slate-navy">{STATUS_CONFIG[selectedBooking.booking_status]?.label || selectedBooking.booking_status}</strong></p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Modal: Chi Tiết Booking ─────────────────────────── */}
        {showDetailModal && detailBooking && (
          <div className="fixed inset-0 z-50 bg-slate-navy/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="rtms-card p-6 max-w-2xl w-full bg-white rounded-3xl shadow-2xl border-2 border-aqua-soft space-y-5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-aqua-soft pb-3">
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-navy">🔍 Chi tiết Đơn hàng #{detailBooking.booking_id}</h3>
                  <div className="mt-1"><StatusBadge status={detailBooking.booking_status} /></div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-slate-navy font-bold text-lg">✕</button>
              </div>

              {loadingDetail ? (
                <div className="py-8 text-center text-gray-500 text-sm">⏳ Đang tải chi tiết đơn hàng...</div>
              ) : (
                <>
                  {/* Route Highlights Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-[#CBF1F5]/60 to-[#A6E3E9]/40 border border-aqua-soft space-y-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Hành Trình Vận Chuyển Thủy</span>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-500 font-semibold block">📍 Cảng Đi (Bốc Hàng):</span>
                        <strong className="text-slate-navy text-sm">{getRouteDetail(detailBooking.route_id).departurePort}</strong>
                        <p className="text-[10px] text-gray-500">{getRouteDetail(detailBooking.route_id).departure}</p>
                      </div>
                      <div className="text-center px-3 py-1 rounded-full bg-white/80 border border-aqua-soft text-[11px] font-bold text-deep-teal shadow-xs">
                        ➔ {getRouteDetail(detailBooking.route_id).distanceKm} km ➔
                      </div>
                      <div className="space-y-0.5 text-right">
                        <span className="text-[10px] text-gray-500 font-semibold block">🏁 Cảng Đến (Dỡ Hàng):</span>
                        <strong className="text-slate-navy text-sm">{getRouteDetail(detailBooking.route_id).destinationPort}</strong>
                        <p className="text-[10px] text-gray-500">{getRouteDetail(detailBooking.route_id).destination}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: "Loại Hàng Hóa",     value: detailBooking.cargo_type },
                      { label: "Tải Trọng",         value: `${detailBooking.cargo_capacity} tấn` },
                      { label: "Ngày Nhận Hàng",    value: new Date(detailBooking.receive_date).toLocaleDateString("vi-VN") },
                      { label: "Ngày Dự Kiến Giao", value: new Date(detailBooking.expected_date).toLocaleDateString("vi-VN") },
                      { label: "Thời Hạn Xử Lý",   value: detailBooking.expired_date ? new Date(detailBooking.expired_date).toLocaleDateString("vi-VN") : "Theo thời hạn quy định" },
                      { label: "Trạng Thái",        value: STATUS_CONFIG[detailBooking.booking_status]?.label || detailBooking.booking_status },
                    ].map(item => (
                      <div key={item.label} className="p-3 rounded-xl bg-cyan-powder/20 border border-aqua-soft">
                        <span className="text-[10px] text-gray-500 font-bold block uppercase">{item.label}</span>
                        <span className="font-bold text-slate-navy mt-0.5 block">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 bg-cyan-powder/20 rounded-2xl border border-aqua-soft">
                    <p className="text-xs font-bold text-slate-navy mb-2">Tiến trình quy trình 6 bước:</p>
                    <WorkflowStepBar status={detailBooking.booking_status} />
                  </div>

                  {/* Port Reviews */}
                  <div>
                    <h4 className="font-bold text-sm text-slate-navy mb-2">⚓ Đánh giá từ các Cảng ({portReviews.length}/2)</h4>
                    {portReviews.length === 0 ? (
                      <p className="text-xs text-gray-500 py-3 text-center bg-cyan-powder/20 rounded-xl">Chưa có Cảng nào gửi đánh giá cho đơn này.</p>
                    ) : (
                      <div className="space-y-2">
                        {portReviews.map((r: any) => (
                          <div key={r.review_id} className="p-3 rounded-xl border border-aqua-soft bg-white flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-navy">Cảng #{r.port_id}</span>
                              {r.review_note && <p className="text-gray-500 mt-0.5">{r.review_note}</p>}
                              {r.review_date && <p className="text-[10px] text-gray-400">{new Date(r.review_date).toLocaleDateString("vi-VN")}</p>}
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${r.review_status === "APPROVED" ? "bg-green-100 text-green-800 border border-green-300" : "bg-red-100 text-red-800 border border-red-300"}`}>
                              {r.review_status === "APPROVED" ? "Đạt điều kiện" : "Từ chối"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Candidate / Accepted Vessels in detail view */}
                  {vesselRequests.length > 0 && (
                    <div>
                      <h4 className="font-bold text-sm text-slate-navy mb-2">🚢 Tình trạng phản hồi của các Tàu ({vesselRequests.length})</h4>
                      <div className="space-y-2">
                        {vesselRequests.map((vr: any) => (
                          <div key={vr.match_id} className="p-3 rounded-xl border border-aqua-soft bg-white text-xs flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-navy">{vr.vessel_summary?.vessel_owner_name || `Tàu #${vr.vessel_id}`}</span>
                              <p className="text-gray-500 mt-0.5">{vr.vessel_summary?.vessel_capacity} tấn | {vr.vessel_summary?.vessel_cargo_type}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              vr.match_status === "ACCEPTED" ? "bg-green-100 text-green-700 border border-green-300"
                              : vr.match_status === "REJECTED" ? "bg-gray-100 text-gray-500 border border-gray-300"
                              : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}>
                              {vr.match_status === "ACCEPTED" ? "✅ Đã đồng ý"
                               : vr.match_status === "REJECTED" ? "✕ Đã từ chối"
                               : "⏳ Đang chờ phản hồi"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailBooking.notes && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      📝 <strong>Ghi chú:</strong> {detailBooking.notes}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
