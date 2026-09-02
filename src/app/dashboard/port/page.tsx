"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationToastContainer } from "@/components/common/NotificationToast";
import { setActiveActor } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  createPortReview,
  finalConfirmBooking,
  listBookings,
  listPortReviews,
  updateBooking,
} from "@/lib/services/booking.service";
import { listPorts } from "@/lib/services/port.service";
import { completePortReviewWorkflow } from "@/lib/services/workflow.service";
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
  EXPIRED:                    { label: "Hết Hạn",               cls: "bg-gray-200 text-gray-700 border border-gray-400" },
  CANCELLED:                  { label: "Đã Hủy",                cls: "bg-rose-100 text-rose-700 border border-rose-300" },
  FAILED:                     { label: "Thất Bại",              cls: "bg-red-100 text-red-900 border border-red-300" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: "bg-gray-100 text-gray-600 border border-gray-300" };
  return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

export default function PortManagerDashboard() {
  const { user } = useAuth();

  const [bookings, setBookings] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [reviewsMap, setReviewsMap] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [selectedPortId, setSelectedPortId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [pendingTabFilter, setPendingTabFilter] = useState<"NEED_MY_REVIEW" | "MY_REVIEWED" | "ALL_MY_PORT" | "CLOSED">("NEED_MY_REVIEW");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (user) {
        setActiveActor(user.userId, user.roleCode);
      }

      const [bRes, pRes]: any[] = await Promise.all([
        listBookings({ page: 1, limit: 100 }),
        listPorts(),
      ]);

      const bItems: any[] = bRes?.data?.items ?? [];
      const pItems: any[] = pRes?.data?.items ?? [];

      setBookings(bItems);
      setPorts(pItems);

      // Tự động tìm cảng gắn chặt với user_id của chủ cảng đang đăng nhập
      let activePortId = selectedPortId;
      if (pItems.length > 0) {
        const userPort = pItems.find(p => p.user_id === user?.userId);
        if (userPort) {
          activePortId = userPort.port_id;
          setSelectedPortId(userPort.port_id);
        } else if (selectedPortId === null) {
          activePortId = pItems[0].port_id;
          setSelectedPortId(pItems[0].port_id);
        }
      }

      // Chỉ nạp review của các đơn hàng có tuyến đi/đến liên quan đến cảng của chủ cảng này
      const relevantBookings = bItems.filter((b: any) => {
        if (!activePortId) return true;
        const r = getRouteDetail(b.route_id);
        return r.departurePortId === activePortId || r.destinationPortId === activePortId;
      });

      if (relevantBookings.length > 0) {
        const reviewResults = await Promise.all(
          relevantBookings.map(async (b: any) => {
            try {
              const res: any = await listPortReviews(b.booking_id);
              return { bookingId: b.booking_id, reviews: res?.data?.items ?? [] };
            } catch {
              return { bookingId: b.booking_id, reviews: [] };
            }
          })
        );
        const map: Record<number, any[]> = {};
        reviewResults.forEach(r => {
          map[r.bookingId] = r.reviews;
        });
        setReviewsMap(map);
      } else {
        setReviewsMap({});
      }
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || "Không thể tải dữ liệu cảng bến";
      setError(msg);
      console.error("[Port] fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedPortId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Kiểm tra đơn hàng có bị hủy hoặc quá hạn hay không
  const isBookingCancelledOrExpired = (b: any) => {
    if (b.booking_status === "CANCELLED" || b.booking_status === "EXPIRED" || b.booking_status === "FAILED") {
      return true;
    }
    if (b.expired_date && new Date(b.expired_date).getTime() < Date.now()) {
      return true;
    }
    return false;
  };

  const handlePortReview = async (bookingId: number, decision: "APPROVED" | "REJECTED") => {
    if (!selectedPortId) return;

    // Ngăn chặn duyệt đơn đã hủy hoặc hết hạn
    const targetBooking = bookings.find(b => b.booking_id === bookingId);
    if (targetBooking && isBookingCancelledOrExpired(targetBooking)) {
      alert("Đơn hàng này đã bị hủy hoặc quá hạn, Cảng không thể kiểm duyệt!");
      return;
    }

    setProcessingId(bookingId);
    const note = reviewNotes[bookingId] || "";

    // Optimistic UI update: Cập nhật ngay reviewsMap để chuyển tab và chặn nút duyệt tức thì
    setReviewsMap(prev => {
      const currentList = prev[bookingId] || [];
      const updated = [
        ...currentList.filter(r => r.port_id !== selectedPortId),
        { port_id: selectedPortId, review_status: decision, review_note: note, review_date: new Date().toISOString() },
      ];
      return { ...prev, [bookingId]: updated };
    });

    try {
      // 1. Tạo bản ghi review cho Cảng hiện tại
      await createPortReview(bookingId, {
        port_id: selectedPortId,
        review_status: decision,
        review_note: note || (decision === "APPROVED"
          ? `Cảng #${selectedPortId} đã kiểm duyệt — đủ điều kiện bốc xếp`
          : `Cảng #${selectedPortId} từ chối — không đủ điều kiện bốc xếp`),
      });

      // 2. Fetch danh sách review để đánh giá 2 cảng
      const prRes: any = await listPortReviews(bookingId);
      const reviews: any[] = prRes?.data?.items ?? [];

      const hasRejected = reviews.some((r: any) => r.review_status === "REJECTED");
      const approvedCount = reviews.filter((r: any) => r.review_status === "APPROVED").length;

      if (hasRejected || decision === "REJECTED") {
        await completePortReviewWorkflow({
          booking_id: bookingId,
          port_review_summary: `Cảng #${selectedPortId} từ chối đơn #${bookingId}`,
          final_review_decision: "REJECTED",
        });
        realtimeHub.notify({
          title: "❌ Cảng Từ Chối Đơn",
          message: `Đơn #${bookingId} bị Cảng #${selectedPortId} từ chối tiếp nhận. Khách hàng đã được thông báo.`,
          type: "warning",
          roleTarget: "CUSTOMER",
        });
      } else if (approvedCount >= 2) {
        await completePortReviewWorkflow({
          booking_id: bookingId,
          port_review_summary: `Cả 2 Cảng đã duyệt đạt yêu cầu (${approvedCount} approved)`,
          final_review_decision: "APPROVED",
        });
        realtimeHub.notify({
          title: "✅ Đủ 2 Cảng Duyệt — Đang Tìm Tàu!",
          message: `Đơn #${bookingId}: 2 Cảng đã phê duyệt. Hệ thống tự động tìm và gửi yêu cầu tới các Chủ tàu phù hợp!`,
          type: "success",
          roleTarget: "VESSEL_OWNER",
        });
      } else {
        realtimeHub.notify({
          title: `⚓ Cảng #${selectedPortId} Đã Duyệt (${approvedCount}/2)`,
          message: `Đơn #${bookingId}: Đã có ${approvedCount}/2 cảng phê duyệt. Đang chờ Cảng còn lại phản hồi theo thời hạn quy định.`,
          type: "info",
        });
      }

      setReviewNotes(prev => { const n = { ...prev }; delete n[bookingId]; return n; });
      fetchData();
    } catch (err: any) {
      alert("Lỗi duyệt cảng: " + (err.error?.message || err.message || "Lỗi thao tác"));
      fetchData();
    } finally {
      setProcessingId(null);
    }
  };

  const handleFinalConfirmation = async (bookingId: number) => {
    if (!selectedPortId) return;
    setProcessingId(bookingId);
    try {
      await finalConfirmBooking(bookingId, {
        port_id: selectedPortId,
        confirmation_note: `Cảng #${selectedPortId} xác nhận hợp đồng vận chuyển chính thức cho Đơn #${bookingId}`,
      });
      realtimeHub.notify({
        title: "📜 Xác nhận Hợp đồng Thành công!",
        message: `Đơn #${bookingId}: Cảng #${selectedPortId} đã XÁC NHẬN CUỐI. Chuyến đi sẵn sàng bốc xếp!`,
        type: "success",
        roleTarget: "ALL",
      });
      fetchData();
    } catch (err: any) {
      alert("Lỗi xác nhận cuối: " + (err.error?.message || err.message || "Lỗi thao tác"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateProgress = async (bookingId: number, newStatus: "IN_PROGRESS" | "COMPLETED") => {
    setProcessingId(bookingId);
    try {
      await updateBooking(bookingId, { booking_status: newStatus });
      realtimeHub.notify({
        title: newStatus === "COMPLETED" ? "🏁 Hoàn Thành Chuyến Hàng!" : "🚢 Đã Bắt Đầu Vận Chuyển",
        message: `Đơn #${bookingId} đã cập nhật tiến trình. Chủ tàu và Khách hàng nhận thông báo tức thời!`,
        type: newStatus === "COMPLETED" ? "success" : "info",
        roleTarget: "ALL",
      });
      fetchData();
    } catch (err: any) {
      alert("Lỗi cập nhật tiến trình: " + (err.error?.message || err.message || "Lỗi thao tác"));
    } finally {
      setProcessingId(null);
    }
  };

  const getPortName = (id: number) => ports.find(p => p.port_id === id)?.port_name || `Cảng #${id}`;
  const userPort = ports.find(p => p.user_id === user?.userId);

  // 1. Chỉ lọc và quản lý các đơn hàng có tuyến đi/đến tại Cảng của chủ cảng hiện tại
  const myPortAllBookings = bookings.filter(b => {
    if (!selectedPortId) return true;
    const route = getRouteDetail(b.route_id);
    return route.departurePortId === selectedPortId || route.destinationPortId === selectedPortId;
  });

  // A. Đơn cần Cảng của bạn duyệt:
  // - Trạng thái: PENDING_PORT_REVIEW
  // - Tuyến đi qua cảng này
  // - CÒN HẠN & CHƯA HỦY
  // - Cảng này CHƯA gửi đánh giá
  const needMyReviewBookings = myPortAllBookings.filter(b => {
    if (b.booking_status !== "PENDING_PORT_REVIEW") return false;
    if (isBookingCancelledOrExpired(b)) return false;
    const bReviews = reviewsMap[b.booking_id] || [];
    const myRev = bReviews.find((r: any) => r.port_id === selectedPortId);
    return !myRev;
  });

  // B. Đơn Cảng của bạn ĐÃ DUYỆT ĐẠT (hoặc các đơn đã qua khâu duyệt cảng)
  const approvedBookings = myPortAllBookings.filter(b => {
    const bReviews = reviewsMap[b.booking_id] || [];
    const myRev = bReviews.find((r: any) => r.port_id === selectedPortId);
    const hasApprovedRecord = myRev?.review_status === "APPROVED";
    const isPastReviewStage = ["WAITING_VESSEL_RESPONSE", "VESSEL_CANDIDATES_READY", "WAITING_CUSTOMER_SELECTION", "WAITING_FINAL_CONFIRMATION", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(b.booking_status);
    return hasApprovedRecord || isPastReviewStage;
  });

  // C. Đơn Hết hạn hoặc Đã hủy
  const closedBookings = myPortAllBookings.filter(b => isBookingCancelledOrExpired(b));

  const getDisplayedBookings = () => {
    switch (pendingTabFilter) {
      case "NEED_MY_REVIEW": return needMyReviewBookings;
      case "MY_REVIEWED":    return approvedBookings;
      case "ALL_MY_PORT":    return myPortAllBookings;
      case "CLOSED":         return closedBookings;
      default:               return needMyReviewBookings;
    }
  };

  const displayedBookings = getDisplayedBookings();

  // 2. Các danh mục khác cũng chỉ hiển thị đơn thuộc cảng của chủ cảng hiện tại
  const finalConfirmBookings = myPortAllBookings.filter(b => b.booking_status === "WAITING_FINAL_CONFIRMATION" && !isBookingCancelledOrExpired(b));
  const inProgressBookings   = myPortAllBookings.filter(b => ["CONFIRMED", "IN_PROGRESS"].includes(b.booking_status));
  const completedBookings    = myPortAllBookings.filter(b => b.booking_status === "COMPLETED");

  return (
    <RoleGuard allowedRoles={["PORT_MANAGER"]}>
      <div className="min-h-screen bg-gradient-to-b from-[#F0F9FA] to-[#E6F7F9]">
        <Header />
        <NotificationToastContainer />
        <div className="flex">
          <Sidebar role="PORT_MANAGER" />
          <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto">

            {/* Banner: Khóa chặt vào Cảng của chủ cảng đang đăng nhập */}
            <div id="overview" className="rtms-card p-6 bg-gradient-to-r from-[#0F4C5C] to-[#142834] text-white flex items-center justify-between shadow-lg scroll-mt-20">
              <div>
                <span className="px-3 py-1 bg-cyan-powder/20 text-cyan-powder border border-cyan-powder/30 rounded-full text-xs font-bold">
                  Ban quản lý: {user?.userName} ({user?.userEmail})
                </span>
                <h2 className="font-heading font-extrabold text-2xl mt-2 text-white">
                  Kiểm Duyệt Cảng & Quản Lý Tiến Trình Vận Chuyển ⚓
                </h2>
                <p className="text-xs text-gray-300 mt-1 max-w-2xl">
                  Chỉ tiếp nhận và kiểm duyệt các đơn đặt chuyến có tuyến vận tải đi hoặc đến tại cảng bạn đang phụ trách. Không áp dụng cho đơn đã hủy hoặc quá hạn.
                </p>
              </div>

              {/* Thông tin Cảng của Chủ Cảng đang đăng nhập */}
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/20 text-right min-w-[260px]">
                <span className="block text-[11px] text-gray-300 font-bold mb-1">Cảng của bạn:</span>
                {userPort ? (
                  <div className="inline-flex items-center gap-2 bg-slate-navy text-cyan-powder px-3.5 py-2 rounded-xl border border-aqua-soft font-extrabold text-xs">
                    <span>⚓</span>
                    <span>{userPort.port_name}</span>
                    <span className="text-gray-300 font-normal">#{userPort.port_id}</span>
                  </div>
                ) : ports.length > 0 ? (
                  <div className="space-y-1">
                    <select
                      value={selectedPortId ?? ""}
                      onChange={e => setSelectedPortId(Number(e.target.value))}
                      className="bg-slate-navy text-white text-xs font-bold p-2.5 rounded-xl border border-aqua-soft focus:outline-none"
                    >
                      {ports.map(p => (
                        <option key={p.port_id} value={p.port_id}>⚓ {p.port_name} (#{p.port_id})</option>
                      ))}
                    </select>
                    <span className="block text-[10px] text-amber-300 font-medium">(Chế độ xem Quản trị)</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Đang tải cảng...</span>
                )}
                {selectedPortId && (
                  <p className="text-[10px] text-gray-300 mt-1">
                    Chỉ quản lý đơn cập bến / xuất bến tại cảng này
                  </p>
                )}
              </div>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Cần Bạn Duyệt Bốc Xếp", count: needMyReviewBookings.length, color: "border-l-amber-500",   icon: "⏳" },
                { label: "Đã Phê Duyệt",          count: approvedBookings.length,      color: "border-l-emerald-500", icon: "✅" },
                { label: "Chờ Xác Nhận Cuối",    count: finalConfirmBookings.length,  color: "border-l-orange-500",  icon: "📜" },
                { label: "Đang Vận Chuyển",       count: inProgressBookings.length,   color: "border-l-teal-500",    icon: "🚢" },
              ].map(kpi => (
                <div key={kpi.label} className={`rtms-card p-4 bg-white flex items-center justify-between border-l-4 ${kpi.color}`}>
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold uppercase">{kpi.label}</p>
                    <h4 className="font-heading font-extrabold text-2xl text-slate-navy mt-1">{kpi.count}</h4>
                  </div>
                  <span className="text-2xl">{kpi.icon}</span>
                </div>
              ))}
            </div>

            {/* Error state */}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold">Lỗi tải dữ liệu</p>
                  <p className="text-xs mt-0.5">{error}</p>
                </div>
                <button onClick={fetchData} className="ml-auto px-3 py-1.5 rounded-lg border border-red-300 text-xs font-bold hover:bg-red-100">Thử lại</button>
              </div>
            )}

            {/* Section 1: Hàng Chờ Kiểm Duyệt Điều Kiện Bốc Xếp */}
            <div id="review-queue" className="rtms-card p-6 scroll-mt-20 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-navy flex items-center gap-2">
                    <span>⚓</span>
                    <span>Kiểm Duyệt Điều Kiện Bốc Xếp — {selectedPortId ? getPortName(selectedPortId) : "Cảng"}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Chỉ hiển thị các đơn vận chuyển đi/đến tại cảng của bạn. Các đơn đã bị hủy hoặc quá hạn sẽ bị khóa duyệt.
                  </p>
                </div>

                {/* Filter Tabs - ĐÃ BỎ "TOÀN HỆ THỐNG", CHỈ GIỮ ĐƠN LIÊN QUAN ĐẾN CẢNG NÀY */}
                <div className="flex gap-1.5 flex-wrap items-center">
                  {[
                    { key: "NEED_MY_REVIEW", label: `⏳ Cần Cảng Bạn Duyệt (${needMyReviewBookings.length})` },
                    { key: "MY_REVIEWED",    label: `✅ Đã Duyệt (${approvedBookings.length})` },
                    { key: "ALL_MY_PORT",    label: `📋 Tất Cả Đơn Qua Cảng (${myPortAllBookings.length})` },
                    { key: "CLOSED",         label: `🚫 Đã Hủy / Quá Hạn (${closedBookings.length})` },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setPendingTabFilter(tab.key as any)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        pendingTabFilter === tab.key
                          ? "bg-deep-teal text-white border-deep-teal shadow-xs"
                          : "bg-white text-gray-600 border-gray-200 hover:border-ocean-teal"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <button onClick={fetchData} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 ml-auto">
                    <span>🔄</span>
                    <span>Tải lại</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <strong>📌 Quy tắc kiểm duyệt:</strong> Mỗi đơn hàng cần cả <strong>Cảng Đi</strong> và <strong>Cảng Đến</strong> đều phê duyệt đạt. Nếu đơn hàng quá hạn hoặc khách đã hủy, hệ thống sẽ tự động đóng duyệt để tránh thao tác nhầm.
              </div>

              {loading ? (
                <div className="py-8 text-center text-gray-500 text-xs">⏳ Đang tải danh sách đơn kiểm duyệt...</div>
              ) : displayedBookings.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs bg-cyan-powder/20 rounded-xl border border-aqua-soft">
                  {pendingTabFilter === "NEED_MY_REVIEW"
                    ? `Hiện không có đơn hàng nào cần ${selectedPortId ? getPortName(selectedPortId) : "Cảng của bạn"} duyệt.`
                    : pendingTabFilter === "MY_REVIEWED"
                    ? `Chưa có đơn hàng nào đã được ${selectedPortId ? getPortName(selectedPortId) : "Cảng của bạn"} phê duyệt.`
                    : pendingTabFilter === "CLOSED"
                    ? "Không có đơn hàng nào bị hủy hoặc quá hạn tại cảng này."
                    : "Không có đơn hàng nào ở mục này."}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedBookings.map(b => {
                    const routeInfo = getRouteDetail(b.route_id);
                    const bookingReviews = reviewsMap[b.booking_id] || [];
                    const myReview = bookingReviews.find((r: any) => r.port_id === selectedPortId);
                    const otherReviews = bookingReviews.filter((r: any) => r.port_id !== selectedPortId);
                    
                    const isCancelled = b.booking_status === "CANCELLED";
                    const isExpired = b.booking_status === "EXPIRED" || (b.expired_date && new Date(b.expired_date).getTime() < Date.now());
                    const isClosed = isCancelled || isExpired;

                    const isApprovedByMe = myReview?.review_status === "APPROVED" || ["WAITING_VESSEL_RESPONSE", "VESSEL_CANDIDATES_READY", "WAITING_CUSTOMER_SELECTION", "WAITING_FINAL_CONFIRMATION", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(b.booking_status);
                    const isRejectedByMe = myReview?.review_status === "REJECTED";
                    const isBothApproved = ["WAITING_VESSEL_RESPONSE", "VESSEL_CANDIDATES_READY", "WAITING_CUSTOMER_SELECTION", "WAITING_FINAL_CONFIRMATION", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(b.booking_status);
                    const approvedCount = isBothApproved ? 2 : bookingReviews.filter((r: any) => r.review_status === "APPROVED").length;
                    const isDeparturePort = routeInfo.departurePortId === selectedPortId;
                    const isDestinationPort = routeInfo.destinationPortId === selectedPortId;

                    return (
                      <div
                        key={b.booking_id}
                        className={`p-5 rounded-2xl border-2 shadow-sm transition-all ${
                          isClosed
                            ? "border-gray-300 bg-gray-50 opacity-80"
                            : isBothApproved
                            ? "border-emerald-400 bg-emerald-50/50"
                            : isApprovedByMe
                            ? "border-emerald-300 bg-emerald-50/30"
                            : isRejectedByMe
                            ? "border-rose-200 bg-rose-50/30"
                            : "border-aqua-soft bg-white hover:border-ocean-teal"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-heading font-extrabold text-base text-slate-navy">Đơn #{b.booking_id}</span>
                              <StatusBadge status={b.booking_status} />
                              
                              {/* Port Role Badge */}
                              {isDeparturePort && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                                  📍 Cảng Bốc Hàng (Cảng Đi)
                                </span>
                              )}
                              {isDestinationPort && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                  🏁 Cảng Dỡ Hàng (Cảng Đến)
                                </span>
                              )}

                              {!isClosed && (
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                  approvedCount >= 2
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-black"
                                    : "bg-cyan-powder text-deep-teal border-aqua-soft"
                                }`}>
                                  {approvedCount}/2 Cảng Đã Duyệt
                                </span>
                              )}
                            </div>

                            {/* Departure -> Destination badge */}
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-powder/40 border border-aqua-soft">
                                <span className="font-bold text-deep-teal">📍 Điểm đi: {routeInfo.departurePort}</span>
                                <span className="text-gray-400 font-bold">➔</span>
                                <span className="font-bold text-deep-teal">🏁 Điểm đến: {routeInfo.destinationPort}</span>
                              </span>
                            </div>

                            <p className="text-xs text-gray-600">
                              Loại hàng: <strong className="text-slate-navy">{b.cargo_type}</strong> | Tải trọng: <strong className="text-deep-teal">{b.cargo_capacity} tấn</strong>
                            </p>
                            <p className="text-[11px] text-gray-400">
                              Ngày nhận: {new Date(b.receive_date).toLocaleDateString("vi-VN")}
                              {b.expired_date && ` | Hạn đơn: ${new Date(b.expired_date).toLocaleDateString("vi-VN")}`}
                              {b.notes ? ` | Ghi chú khách: ${b.notes}` : ""}
                            </p>

                            {/* Review Status of other ports */}
                            {otherReviews.length > 0 && !isBothApproved && !isClosed && (
                              <div className="p-2 rounded-xl bg-cyan-powder/30 border border-aqua-soft text-[11px] text-slate-navy">
                                ⚓ Cảng đối tác: {otherReviews.map((or: any) => (
                                  <span key={or.port_id} className="font-bold text-deep-teal mr-2">
                                    {getPortName(or.port_id)}: {or.review_status === "APPROVED" ? "✅ Đã duyệt đạt" : "✕ Từ chối"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Action / Status Panel for current Port */}
                          {isCancelled ? (
                            <div className="p-3.5 rounded-2xl bg-gray-100 border border-gray-300 text-center min-w-[240px]">
                              <span className="font-bold text-xs text-gray-700 flex items-center justify-center gap-1.5">
                                <span>🚫</span>
                                <span>ĐƠN HÀNG ĐÃ BỊ HỦY</span>
                              </span>
                              <span className="text-[11px] text-gray-500 mt-1 block">
                                Khách hàng hoặc hệ thống đã hủy đơn. Không thể kiểm duyệt.
                              </span>
                            </div>
                          ) : isExpired ? (
                            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-center min-w-[240px]">
                              <span className="font-bold text-xs text-amber-800 flex items-center justify-center gap-1.5">
                                <span>⏰</span>
                                <span>ĐƠN HÀNG ĐÃ QUÁ HẠN</span>
                              </span>
                              <span className="text-[11px] text-amber-700 mt-1 block">
                                Đã hết hạn tiếp nhận ({new Date(b.expired_date).toLocaleDateString("vi-VN")}). Hệ thống đã đóng duyệt.
                              </span>
                            </div>
                          ) : isBothApproved ? (
                            <div className="p-4 rounded-2xl bg-emerald-100/80 border border-emerald-300 text-center min-w-[260px] space-y-1.5">
                              <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-900">
                                <span>🎉</span>
                                <span>CẢ 2 CẢNG ĐÃ DUYỆT ĐẠT (2/2)</span>
                              </div>
                              <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                                {b.booking_status === "WAITING_VESSEL_RESPONSE"
                                  ? "📡 Đang chờ các chủ tàu phản hồi nhận chuyến"
                                  : b.booking_status === "WAITING_CUSTOMER_SELECTION"
                                  ? "🤝 Đã gom tàu nhận — Khách đang chọn phương tiện"
                                  : b.booking_status === "WAITING_FINAL_CONFIRMATION"
                                  ? "📜 Khách đã chọn tàu — Chờ Cảng xác nhận hợp đồng cuối bên dưới"
                                  : b.booking_status === "IN_PROGRESS" || b.booking_status === "CONFIRMED"
                                  ? "🚢 Đang trong tiến trình vận chuyển"
                                  : "✅ Đơn hàng đã hoàn tất vận chuyển"}
                              </p>
                              {myReview?.review_note && (
                                <p className="text-[10px] text-gray-600 italic bg-white/70 p-1.5 rounded-lg border border-emerald-200">
                                  Ghi chú cảng: &quot;{myReview.review_note}&quot;
                                </p>
                              )}
                            </div>
                          ) : isApprovedByMe ? (
                            <div className="p-4 rounded-2xl bg-emerald-100/70 border border-emerald-300 text-center min-w-[250px] space-y-1.5">
                              <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-900">
                                <span>✅</span>
                                <span>Cảng của bạn ĐÃ DUYỆT ĐẠT (1/2)</span>
                              </div>
                              <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                                Đang chờ Cảng đối tác hoàn tất kiểm duyệt để tự động chuyển sang bước tìm và gom tàu.
                              </p>
                              {myReview?.review_note && (
                                <p className="text-[10px] text-gray-600 italic bg-white/70 p-1.5 rounded-lg border border-emerald-200">
                                  Ghi chú đã gửi: &quot;{myReview.review_note}&quot;
                                </p>
                              )}
                            </div>
                          ) : isRejectedByMe ? (
                            <div className="p-4 rounded-2xl bg-rose-100/70 border border-rose-300 text-center min-w-[220px]">
                              <span className="font-bold text-xs text-rose-900">✕ Cảng của bạn đã từ chối</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {otherReviews.length > 0 && otherReviews.some((or: any) => or.review_status === "APPROVED") && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 text-center">
                                  ⚓ Cảng đối tác đã duyệt. Cần bạn duyệt để hoàn tất!
                                </span>
                              )}
                              <input
                                type="text"
                                placeholder="Ghi chú điều kiện cầu cảng / bốc xếp..."
                                value={reviewNotes[b.booking_id] || ""}
                                onChange={e => setReviewNotes(prev => ({ ...prev, [b.booking_id]: e.target.value }))}
                                className="p-2.5 rounded-xl border border-aqua-soft text-xs text-slate-navy focus:outline-none bg-cyan-powder/20 w-60 font-medium"
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handlePortReview(b.booking_id, "REJECTED")}
                                  disabled={processingId === b.booking_id || !selectedPortId}
                                  className="px-3.5 py-2 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs disabled:opacity-50 transition-all"
                                >
                                  ✕ Từ Chối
                                </button>
                                <button
                                  onClick={() => handlePortReview(b.booking_id, "APPROVED")}
                                  disabled={processingId === b.booking_id || !selectedPortId}
                                  className="btn-primary text-xs px-4 py-2 shadow-xs disabled:opacity-50 font-bold"
                                >
                                  {processingId === b.booking_id ? "⏳ Đang duyệt..." : "✅ Duyệt Đạt Cảng"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: Chờ Xác Nhận Cuối */}
            <div id="final-confirmation" className="rtms-card p-6 scroll-mt-20">
              <h3 className="font-heading font-bold text-lg text-slate-navy mb-2 flex items-center gap-2">
                <span>📜</span>
                <span>Hàng Chờ Xác Nhận Hợp Đồng Vận Tải Cuối ({finalConfirmBookings.length})</span>
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Chủ hàng đã chọn phương tiện vận tải. Ban quản lý cảng xác nhận hợp đồng chính thức để cho phép phương tiện cập cảng bốc hàng.
              </p>

              {finalConfirmBookings.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-xs bg-cyan-powder/20 rounded-xl border border-aqua-soft">
                  Không có đơn nào đang chờ xác nhận hợp đồng cuối tại cảng bạn phụ trách.
                </div>
              ) : (
                <div className="space-y-3">
                  {finalConfirmBookings.map(b => {
                    const routeInfo = getRouteDetail(b.route_id);

                    return (
                      <div key={b.booking_id} className="p-5 rounded-2xl border-2 border-orange-300 bg-orange-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-base text-slate-navy">Đơn #{b.booking_id}</span>
                            <StatusBadge status={b.booking_status} />
                          </div>
                          <p className="text-xs text-gray-700 font-medium">
                            {b.cargo_type} — {b.cargo_capacity} tấn | <strong>📍 {routeInfo.departurePort} ➔ 🏁 {routeInfo.destinationPort}</strong>
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Khách đã chọn tàu. Đại diện <strong>{selectedPortId ? getPortName(selectedPortId) : "Cảng"}</strong> xác nhận hợp đồng để bắt đầu tiến hành.
                          </p>
                        </div>
                        <button
                          onClick={() => handleFinalConfirmation(b.booking_id)}
                          disabled={processingId === b.booking_id || !selectedPortId}
                          className="btn-primary text-xs px-5 py-2.5 shadow-md disabled:opacity-50 font-bold"
                        >
                          {processingId === b.booking_id ? "⏳ Đang xác nhận..." : "📜 Xác Nhận Hợp Đồng Cuối"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Cập nhật Tiến trình Vận chuyển */}
            <div id="shipment-tracking" className="rtms-card p-6 scroll-mt-20">
              <h3 className="font-heading font-bold text-lg text-slate-navy mb-2 flex items-center gap-2">
                <span>🚢</span>
                <span>Tiến Trình Vận Chuyển & Giao Nhận Hàng ({inProgressBookings.length} chuyến)</span>
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Cập nhật trạng thái thực tế khi tàu rời bến và khi hoàn tất dỡ hàng an toàn tại cảng bạn phụ trách.
              </p>

              {inProgressBookings.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-xs bg-cyan-powder/20 rounded-xl border border-aqua-soft">
                  Chưa có chuyến đi nào đang trong tiến trình vận chuyển qua cảng bạn.
                </div>
              ) : (
                <div className="space-y-4">
                  {inProgressBookings.map(b => {
                    const routeInfo = getRouteDetail(b.route_id);

                    return (
                      <div key={b.booking_id} className="p-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-base text-slate-navy">Đơn #{b.booking_id}</span>
                            <StatusBadge status={b.booking_status} />
                          </div>
                          <p className="text-xs text-gray-700 font-medium">
                            {b.cargo_type} — {b.cargo_capacity} tấn | <strong>📍 {routeInfo.departurePort} ➔ 🏁 {routeInfo.destinationPort}</strong>
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Phương tiện đang thực hiện vận chuyển trên tuyến sông.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {b.booking_status === "CONFIRMED" && (
                            <button
                              onClick={() => handleUpdateProgress(b.booking_id, "IN_PROGRESS")}
                              disabled={processingId === b.booking_id}
                              className="btn-primary text-xs px-4 py-2 shadow-xs disabled:opacity-50 font-bold"
                            >
                              {processingId === b.booking_id ? "⏳..." : "🚢 Tàu Xuất Bến"}
                            </button>
                          )}
                          {b.booking_status === "IN_PROGRESS" && (
                            <button
                              onClick={() => handleUpdateProgress(b.booking_id, "COMPLETED")}
                              disabled={processingId === b.booking_id}
                              className="btn-primary bg-teal-700 hover:bg-teal-800 text-white text-xs px-4 py-2 shadow-xs disabled:opacity-50 font-bold"
                            >
                              {processingId === b.booking_id ? "⏳..." : "🏁 Hoàn Tất Dỡ Hàng"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
