/**
 * Danh mục Tuyến Vận Tải Đường Thủy Nội Địa
 * Ánh xạ chính xác giữa Route ID, Cảng Đi (Departure) và Cảng Đến (Destination)
 */

export interface RouteDetail {
  routeId: number;
  routeCode: string;
  departure: string;
  destination: string;
  departurePort: string;
  destinationPort: string;
  departurePortId?: number;
  destinationPortId?: number;
  label: string;
  distanceKm?: number;
}

export const ROUTES_MAP: Record<number, RouteDetail> = {
  1: {
    routeId: 1,
    routeCode: "ROUTE_CATLAI_CANTHO",
    departure: "TP. Hồ Chí Minh",
    destination: "Cần Thơ",
    departurePort: "Cảng Cát Lái",
    destinationPort: "Cảng Cần Thơ",
    departurePortId: 1,
    destinationPortId: 3,
    label: "Cảng Cát Lái (TP.HCM) ➔ Cảng Cần Thơ",
    distanceKm: 165,
  },
  2: {
    routeId: 2,
    routeCode: "ROUTE_CATLAI_LONGAN",
    departure: "TP. Hồ Chí Minh",
    destination: "Long An",
    departurePort: "Cảng Cát Lái",
    destinationPort: "Cảng Long An",
    departurePortId: 1,
    destinationPortId: 5,
    label: "Cảng Cát Lái (TP.HCM) ➔ Cảng Long An",
    distanceKm: 45,
  },
  3: {
    routeId: 3,
    routeCode: "ROUTE_CATLAI_MYTHO",
    departure: "TP. Hồ Chí Minh",
    destination: "Tiền Giang",
    departurePort: "Cảng Cát Lái",
    destinationPort: "Cảng Mỹ Tho",
    departurePortId: 1,
    destinationPortId: 4,
    label: "Cảng Cát Lái (TP.HCM) ➔ Cảng Mỹ Tho (Tiền Giang)",
    distanceKm: 75,
  },
  4: {
    routeId: 4,
    routeCode: "ROUTE_HIEPPHUOC_CANTHO",
    departure: "TP. Hồ Chí Minh",
    destination: "Cần Thơ",
    departurePort: "Cảng Hiệp Phước",
    destinationPort: "Cảng Cần Thơ",
    departurePortId: 2,
    destinationPortId: 3,
    label: "Cảng Hiệp Phước (TP.HCM) ➔ Cảng Cần Thơ",
    distanceKm: 155,
  },
  5: {
    routeId: 5,
    routeCode: "ROUTE_CANTHO_MYTHO",
    departure: "Cần Thơ",
    destination: "Tiền Giang",
    departurePort: "Cảng Cần Thơ",
    destinationPort: "Cảng Mỹ Tho",
    departurePortId: 3,
    destinationPortId: 4,
    label: "Cảng Cần Thơ ➔ Cảng Mỹ Tho (Tiền Giang)",
    distanceKm: 90,
  },
  6: {
    routeId: 6,
    routeCode: "ROUTE_LONGAN_MYTHO",
    departure: "Long An",
    destination: "Tiền Giang",
    departurePort: "Cảng Long An",
    destinationPort: "Cảng Mỹ Tho",
    departurePortId: 5,
    destinationPortId: 4,
    label: "Cảng Long An ➔ Cảng Mỹ Tho (Tiền Giang)",
    distanceKm: 50,
  },
};

export const ROUTES_LIST: RouteDetail[] = Object.values(ROUTES_MAP);

/**
 * Trả về chuỗi mô tả tuyến rõ ràng Điểm đi ➔ Điểm đến
 */
export function formatRouteLabel(routeId: number | string | undefined | null): string {
  const id = Number(routeId);
  if (!id || !ROUTES_MAP[id]) {
    return routeId ? `Tuyến #${routeId}` : "Chưa xác định tuyến";
  }
  return ROUTES_MAP[id].label;
}

/**
 * Lấy chi tiết thông tin Tuyến vận tải
 */
export function getRouteDetail(routeId: number | string | undefined | null): RouteDetail {
  const id = Number(routeId);
  if (id && ROUTES_MAP[id]) {
    return ROUTES_MAP[id];
  }
  return {
    routeId: id || 1,
    routeCode: "UNKNOWN",
    departure: "Cảng xuất phát",
    destination: "Cảng đích",
    departurePort: "Cảng bốc hàng",
    destinationPort: "Cảng dỡ hàng",
    departurePortId: 1,
    destinationPortId: 3,
    label: id ? `Tuyến vận chuyển #${id}` : "Chưa xác định tuyến",
  };
}
