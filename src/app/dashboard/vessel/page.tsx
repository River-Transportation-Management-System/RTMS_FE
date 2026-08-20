"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationToastContainer } from "@/components/common/NotificationToast";
import { setActiveActor } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { getBookingVesselRequests, listBookings } from "@/lib/services/booking.service";
import { listVessels, respondVesselMatch, updateVessel } from "@/lib/services/vessel.service";
import { respondVesselWorkflow } from "@/lib/services/workflow.service";
import { realtimeHub } from "@/lib/realtime";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { getRouteDetail, formatRouteLabel } from "@/lib/routes";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING_PORT_REVIEW:        { label: "Chờ Cảng Duyệt",       cls: "bg-amber-100 text-amber-800 border border-amber-300" },
  WAITING_VESSEL_RESPONSE:    { label: "Chờ Tàu Phản Hồi",      cls: "bg-blue-100 text-blue-800 border border-blue-300" },
  VESSEL_CANDIDATES_READY:    { label: "Có Tàu Nhận Chuyến",   cls: "bg-cyan-100 text-cyan-800 border border-cyan-300" },
  WAITING_CUSTOMER_SELECTION: { label: "Chờ Khách Chọn Tàu",    cls: "bg-purple-100 text-purple-800 border border-purple-300" },
  WAITING_FINAL_CONFIRMATION: { label: "Chờ XN Cuối",           cls: "bg-orange-100 text-orange-800 border border-orange-300" },
  CONFIRMED:                  { label: "Đã Xác Nhận",           cls: "bg-green-100 text-green-800 border border-green-300" },
  IN_PROGRESS:                { label: "Đang Vận Chuyển",       cls: "bg-emerald-100 text-emerald-800 border border-emerald-300" },
  COMPLETED:                  { label: "Hoàn Thành",            cls: "bg-teal-100 text-teal-800 border border-teal-300" },
  EXPIRED:                    { label: "Đã Hết Hạn",            cls: "bg-gray-100 text-gray-600 border border-gray-300" },
  CANCELLED:                  { label: "Đã Hủy",                cls: "bg-gray-100 text-gray-500 border border-gray-300" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: "bg-gray-100 text-gray-600 border border-gray-300" };
  return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

interface MatchRequest {
  match_id: number;
  booking_id: number;
  booking_status: string;
  cargo_type: string;
  cargo_capacity: string;
  route_id: number;
  receive_date: string;
  expired_date?: string;
  vessel_id: number;
  match_status: "PENDING" | "ACCEPTED" | "REJECTED" | "SELECTED" | "EXPIRED" | "TIMEOUT";
  vessel_owner_name?: string;
}

export default function VesselOwnerDashboard() {
  const { user } = useAuth();

  const [vessels, setVessels] = useState<any[]>([]);
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [processingMatch, setProcessingMatch] = useState<number | null>(null);
  const [tabFilter, setTabFilter] = useState<"ALL" | "PENDING" | "ACCEPTED" | "CLOSED">("ALL");

  const currentUserId = user?.userId || 16;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (user) {
        setActiveActor(user.userId, user.roleCode);
      }

      // 1. Tải danh sách phương tiện thuộc sở hữu của chủ tàu này
      const vRes: any = await listVessels({ page: 1, limit: 50, user_id: currentUserId });
      const myVessels: any[] = vRes?.data?.items ?? [];
      setVessels(myVessels);

      const myVesselIds = new Set(myVessels.map(v => Number(v.vessel_id)));

      // 2. Tải danh sách đơn hàng để lọc các yêu cầu ghép tàu dành riêng cho đội tàu này
      const bRes: any = await listBookings({ page: 1, limit: 50 });
      const allBookings: any[] = bRes?.data?.items ?? [];

      const myMatches: MatchRequest[] = [];

      await Promise.all(
        allBookings.map(async (b: any) => {
          try {
            const vrRes: any = await getBookingVesselRequests(b.booking_id);
            const items: any[] = vrRes?.data?.items ?? [];

            items.forEach((vr: any) => {
              const vrVesselId = Number(vr.vessel_id);
              const vrUserId = Number(vr.vessel_summary?.user_id);

              // CHỈ LẤY NHỮNG YÊU CẦU GHÉP TÀU GỬI ĐẾN ĐỘI TÀU THUỘC SỞ HỮU CỦA CHỦ TÀU NÀY
              if (myVesselIds.has(vrVesselId) || vrUserId === currentUserId) {
                myMatches.push({
                  match_id: vr.match_id,
                  booking_id: b.booking_id,
                  booking_status: b.booking_status,
                  cargo_type: b.cargo_type,
                  cargo_capacity: b.cargo_capacity,
                  route_id: b.route_id,
                  receive_date: b.receive_date,
                  expired_date: b.expired_date,
                  vessel_id: vrVesselId,
                  match_status: (vr.match_status as any) ?? "PENDING",
                  vessel_owner_name: vr.vessel_summary?.vessel_owner_name,
                });
              }
            });
          } catch (innerErr) {
            console.warn(`[Vessel] vessel-requests booking #${b.booking_id}:`, innerErr);
          }
        })
      );

      // Sắp xếp các đơn chờ phản hồi lên đầu
      myMatches.sort((a, b) => {
        if (a.match_status === "PENDING" && b.match_status !== "PENDING") return -1;
        if (a.match_status !== "PENDING" && b.match_status === "PENDING") return 1;
        return b.booking_id - a.booking_id;
      });

      setMatchRequests(myMatches);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || "Không thể tải dữ liệu chủ phương tiện";
      setError(msg);
      console.error("[Vessel] fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRespondMatch = async (matchId: number, bookingId: number, status: "ACCEPT" | "REJECT") => {
    setProcessingMatch(matchId);
    const reason = rejectReason[matchId] || "";
    try {
      await respondVesselMatch(matchId, {
        response_status: status,
        reason: status === "REJECT"
          ? (reason || "Phương tiện không thể nhận chuyến vào thời điểm này")
          : "Đồng ý nhận chuyến vận tải đường thủy",
      });

      await respondVesselWorkflow({
        request_id: matchId,
        vessel_response_status: status === "ACCEPT" ? "ACCEPTED" : "REJECTED",
        response_timestamp: new Date().toISOString(),
      });

      realtimeHub.notify({
        title: status === "ACCEPT" ? "✅ Đồng Ý Nhận Chuyến!" : "Đã Từ Chối Chuyến",
        message: status === "ACCEPT"
          ? `Bạn đã ĐỒNG Ý nhận Đơn #${bookingId}. Hệ thống sẽ tổng hợp để Khách hàng lựa chọn!`
          : `Đã TỪ CHỐI Đơn #${bookingId}. Lý do: ${reason || "Không thể nhận chuyến"}`,
        type: status === "ACCEPT" ? "success" : "warning",
        roleTarget: status === "ACCEPT" ? "CUSTOMER" : undefined,
      });

      setMatchRequests(prev =>
        prev.map(m => m.match_id === matchId
          ? { ...m, match_status: status === "ACCEPT" ? "ACCEPTED" : "REJECTED" }
          : m
        )
      );
      setRejectReason(prev => { const n = { ...prev }; delete n[matchId]; return n; });
    } catch (err: any) {
      alert("Lỗi phản hồi ghép tàu: " + (err.error?.message || err.message || "Lỗi thao tác"));
    } finally {
      setProcessingMatch(null);
    }
  };

  const handleToggleVesselStatus = async (vesselId: number, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateVessel(vesselId, { vessel_status: newStatus });
      realtimeHub.notify({
        title: "Cập nhật Trạng thái Tàu",
        message: `Tàu #${vesselId} chuyển sang → ${newStatus === "ACTIVE" ? "SẴN SÀNG" : "TẠM NGƯNG"}`,
        type: newStatus === "ACTIVE" ? "success" : "warning",
      });
      fetchData();
    } catch (err: any) {
      alert("Lỗi cập nhật tàu: " + (err.error?.message || err.message || "Lỗi thao tác"));
    }
  };

  const isBookingClosed = (m: MatchRequest) => {
    return ["CANCELLED", "EXPIRED", "NO_VESSEL_ACCEPTED", "REJECTED_BY_PORT"].includes(m.booking_status) ||
      ["EXPIRED", "TIMEOUT"].includes(m.match_status);
  };

  const pendingMatches   = matchRequests.filter(m => m.match_status === "PENDING" && !isBookingClosed(m));
  const acceptedMatches  = matchRequests.filter(m => ["ACCEPTED", "SELECTED"].includes(m.match_status) && !isBookingClosed(m));
  const closedMatches    = matchRequests.filter(m => isBookingClosed(m) || m.match_status === "REJECTED");
  const activeVessels    = vessels.filter(v => v.vessel_status === "ACTIVE");
  const inactiveVessels  = vessels.filter(v => v.vessel_status !== "ACTIVE");

  const getFilteredRequests = () => {
    switch (tabFilter) {
      case "PENDING":  return pendingMatches;
      case "ACCEPTED": return acceptedMatches;
      case "CLOSED":   return closedMatches;
      default:         return matchRequests;
    }
  };

  const filteredRequests = getFilteredRequests();

  return (
    <RoleGuard allowedRoles={["VESSEL_OWNER"]}>
      <div className="min-h-screen bg-gradient-to-b from-[#F0F9FA] to-[#E6F7F9]">
        <Header />
        <NotificationToastContainer />
        <div className="flex">
          <Sidebar role="VESSEL_OWNER" />
          <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto">

            {/* Banner */}
            <div id="overview" className="rtms-card p-6 bg-gradient-to-r from-[#71C9CE] via-[#A6E3E9] to-[#CBF1F5] text-slate-navy flex items-center justify-between shadow-md scroll-mt-20">
              <div>
                <span className="px-3 py-1 bg-white/80 rounded-full text-xs font-bold text-deep-teal shadow-xs">
                  Chủ tàu: {user?.userName} ({user?.userEmail})
                </span>
                <h2 className="font-heading font-extrabold text-2xl mt-2">
                  Quản Lý Yêu Cầu Ghép Chuyến & Đội Tàu 🚢
                </h2>
                <p className="text-xs text-slate-navy/80 mt-1 max-w-2xl">
                  Tiếp nhận các yêu cầu vận chuyển phù hợp sau khi 2 Cảng đã kiểm duyệt. Phản hồi nhận/từ chối để gửi danh sách tới Chủ hàng.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-right">
                <div className="flex gap-2 text-[10px] font-bold">
                  <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full border border-green-300">
                    {activeVessels.length} Tàu Sẵn Sàng
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full border border-gray-300">
                    {inactiveVessels.length} Tàu Tạm Ngưng
                  </span>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={fetchData} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                    <span>🔄</span>
                    <span>Làm mới Dữ liệu</span>
                  </button>
                </div>
              </div>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Chờ Phản Hồi", count: pendingMatches.length,   color: "border-l-amber-500",   icon: "📥" },
                { label: "Đã Nhận Chuyến", count: acceptedMatches.length, color: "border-l-emerald-500", icon: "✅" },
                { label: "Đã Đóng / Quá Hạn", count: closedMatches.length, color: "border-l-gray-400",    icon: "🛑" },
                { label: "Tàu Của Bạn",   count: vessels.length,         color: "border-l-cyan-500",    icon: "🚤" },
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

            {/* Section 1: Hộp thư Yêu cầu Ghép Tàu */}
            <div id="match-inbox" className="rtms-card p-6 scroll-mt-20">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-navy flex items-center gap-2">
                    <span>📥</span>
                    <span>Hộp Thư Yêu Cầu Ghép Chuyến Cho Đội Tàu Của Bạn ({matchRequests.length})</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Chỉ hiển thị các yêu cầu ghép chuyến phù hợp với phương tiện thuộc sở hữu của bạn.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { key: "ALL",      label: `Tất Cả (${matchRequests.length})` },
                    { key: "PENDING",  label: `Chờ Phản Hồi (${pendingMatches.length})` },
                    { key: "ACCEPTED", label: `Đã Nhận (${acceptedMatches.length})` },
                    { key: "CLOSED",   label: `Đã Đóng / Hủy (${closedMatches.length})` },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setTabFilter(tab.key as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        tabFilter === tab.key
                          ? "bg-deep-teal text-white border-deep-teal shadow-xs"
                          : "bg-white text-gray-600 border-gray-200 hover:border-ocean-teal"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <strong>📌 Thông tin vận hành:</strong> Bạn có thời hạn quy định để phản hồi yêu cầu. Khi hết hạn tiếp nhận hoặc nếu khách hàng hủy đơn, yêu cầu sẽ tự động đóng lại để giải phóng phương tiện.
              </div>

              {/* Error state */}
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 mb-4">
                  <span>⚠️</span>
                  <span>{error}</span>
                  <button onClick={fetchData} className="ml-auto underline font-bold">Thử lại</button>
                </div>
              )}

              {loading ? (
                <div className="py-8 text-center text-gray-500 text-xs">⏳ Đang tải danh sách yêu cầu ghép chuyến...</div>
              ) : filteredRequests.length === 0 ? (
                <div className="py-8 text-center text-gray-400 font-medium text-xs bg-cyan-powder/20 rounded-xl border border-aqua-soft">
                  {vessels.length === 0
                    ? "Tài khoản của bạn chưa đăng ký phương tiện tàu nào."
                    : tabFilter === "ALL"
                    ? "Hiện không có yêu cầu ghép chuyến nào cho đội tàu của bạn."
                    : "Không có yêu cầu nào ở mục này."}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRequests.map(m => {
                    const routeInfo = getRouteDetail(m.route_id);
                    const isClosed = isBookingClosed(m);
                    const isCancelledBooking = m.booking_status === "CANCELLED";
                    const isExpiredBooking = m.booking_status === "EXPIRED" || m.match_status === "EXPIRED" || m.match_status === "TIMEOUT";

                    return (
                      <div key={m.match_id} className={`p-5 rounded-2xl border-2 shadow-xs transition-all ${
                        isClosed ? "border-gray-200 bg-gray-50/80 opacity-80"
                        : m.match_status === "ACCEPTED" || m.match_status === "SELECTED" ? "border-green-300 bg-green-50/50"
                        : "border-aqua-soft bg-white hover:border-ocean-teal"
                      }`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-heading font-bold text-base text-slate-navy">
                                Đơn #{m.booking_id} — Yêu cầu ghép #{m.match_id}
                              </span>

                              {/* Status Tag */}
                              {isCancelledBooking ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  🛑 Đơn hàng đã hủy
                                </span>
                              ) : isExpiredBooking ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700 border border-gray-300">
                                  ⌛ Đơn hàng đã quá hạn
                                </span>
                              ) : m.match_status === "ACCEPTED" ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-300">
                                  ✅ Đã đồng ý nhận chuyến
                                </span>
                              ) : m.match_status === "SELECTED" ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                                  🎉 Đã được chọn vận chuyển chính thức
                                </span>
                              ) : m.match_status === "REJECTED" ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                                  ✕ Đã từ chối nhận
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                  ⏳ Chờ Bạn Phản Hồi
                                </span>
                              )}
                            </div>

                            {/* Rich Route Display */}
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-powder/40 border border-aqua-soft">
                                <span className="font-bold text-deep-teal">📍 Điểm đi: {routeInfo.departurePort}</span>
                                <span className="text-gray-400 font-bold">➔</span>
                                <span className="font-bold text-deep-teal">🏁 Điểm đến: {routeInfo.destinationPort}</span>
                                {routeInfo.distanceKm && (
                                  <span className="text-[10px] font-semibold text-gray-500 ml-1">({routeInfo.distanceKm} km)</span>
                                )}
                              </span>
                            </div>

                            <p className="text-xs text-gray-600">
                              Loại hàng: <strong className="text-slate-navy">{m.cargo_type}</strong>{" "}
                              | Tải trọng: <strong className="text-deep-teal">{m.cargo_capacity} tấn</strong>
                            </p>
                            <p className="text-[11px] text-gray-400">
                              Ngày nhận hàng: {new Date(m.receive_date).toLocaleDateString("vi-VN")}
                            </p>
                            
                            {/* Targeted Vessel Badge */}
                            <div className="p-2 rounded-xl bg-cyan-powder/30 border border-aqua-soft text-[11px] text-slate-navy font-semibold inline-block">
                              🚤 Phương tiện của bạn nhận yêu cầu: <strong className="text-deep-teal">{m.vessel_owner_name || `Tàu #${m.vessel_id}`}</strong> (Mã tàu #{m.vessel_id})
                            </div>
                          </div>

                          {/* Action Buttons based on state */}
                          {m.match_status === "PENDING" && !isClosed ? (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                placeholder="Lý do từ chối (nếu không nhận)..."
                                value={rejectReason[m.match_id] || ""}
                                onChange={e => setRejectReason(prev => ({ ...prev, [m.match_id]: e.target.value }))}
                                className="p-2.5 rounded-xl border border-aqua-soft text-xs focus:outline-none bg-cyan-powder/20 w-56 font-medium"
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleRespondMatch(m.match_id, m.booking_id, "REJECT")}
                                  disabled={processingMatch === m.match_id}
                                  className="px-3.5 py-2 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs disabled:opacity-50 transition-all"
                                >
                                  ✕ Từ Chối
                                </button>
                                <button
                                  onClick={() => handleRespondMatch(m.match_id, m.booking_id, "ACCEPT")}
                                  disabled={processingMatch === m.match_id}
                                  className="btn-primary text-xs px-4 py-2 shadow-xs disabled:opacity-50 font-bold"
                                >
                                  {processingMatch === m.match_id ? "⏳ Đang gửi..." : "✅ Đồng Ý Nhận Chuyến"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className={`text-xs font-bold px-4 py-2.5 rounded-xl text-center min-w-[170px] ${
                              isCancelledBooking ? "text-rose-700 bg-rose-50 border border-rose-200"
                              : isExpiredBooking ? "text-gray-600 bg-gray-100 border border-gray-200"
                              : m.match_status === "ACCEPTED" ? "text-green-800 bg-green-100 border border-green-200"
                              : m.match_status === "SELECTED" ? "text-white bg-emerald-600 shadow-xs"
                              : "text-gray-600 bg-gray-100 border border-gray-200"
                            }`}>
                              {isCancelledBooking ? "🛑 Đơn hàng đã bị hủy"
                               : isExpiredBooking ? "⌛ Đã hết hạn xử lý"
                               : m.match_status === "ACCEPTED" ? "✅ Đã đồng ý (Chờ khách chọn)"
                               : m.match_status === "SELECTED" ? "🎉 Đã được chọn vận chuyển"
                               : "✕ Đã từ chối nhận"}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: Quản lý Đội Tàu */}
            <div id="fleet-management" className="rtms-card p-6 scroll-mt-20">
              <h3 className="font-heading font-bold text-lg text-slate-navy mb-2 flex items-center gap-2">
                <span>🚤</span>
                <span>Quản Lý Đội Tàu Của Bạn ({vessels.length} phương tiện)</span>
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Phương tiện ở trạng thái TẠM NGƯNG sẽ không nhận đề xuất ghép chuyến mới. Hãy chuyển sang SẴN SÀNG khi tàu có thể nhận hàng.
              </p>

              {loading ? (
                <div className="py-8 text-center text-gray-500 text-xs">⏳ Đang tải danh sách phương tiện...</div>
              ) : vessels.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs bg-cyan-powder/20 rounded-xl border border-aqua-soft">
                  Chưa có phương tiện nào được đăng ký dưới tài khoản này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vessels.map(v => (
                    <div key={v.vessel_id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                      v.vessel_status === "ACTIVE" ? "border-emerald-200 bg-emerald-50/70" : "border-gray-200 bg-gray-50"
                    }`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-sm text-slate-navy">{v.vessel_owner_name}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full ${
                            v.vessel_status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-gray-100 text-gray-500 border border-gray-300"
                          }`}>
                            {v.vessel_status === "ACTIVE" ? "Sẵn sàng" : "Tạm ngưng"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Sức chứa: <span className="font-bold text-deep-teal">{v.vessel_capacity} tấn</span>{" "}
                          | Chuyên chở: <span className="font-bold">{v.vessel_cargo_type}</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Mã phương tiện #{v.vessel_id}</p>
                      </div>
                      <button
                        onClick={() => handleToggleVesselStatus(v.vessel_id, v.vessel_status)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          v.vessel_status === "ACTIVE"
                            ? "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
                        }`}
                      >
                        {v.vessel_status === "ACTIVE" ? "⏸️ Tạm Ngưng" : "▶️ Sẵn Sàng"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
