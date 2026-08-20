import axios from "axios";

// Base URL: dùng biến môi trường hoặc proxy route
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api/v1" : "http://localhost:3001/api/v1");

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

let activeUserId = "1";
let activeRoleCode = "ADMIN";
let authToken = "";

export function setActiveActor(userId: string | number, roleCode: string) {
  activeUserId = String(userId);
  activeRoleCode = roleCode.toUpperCase();
}

export function setAuthToken(token: string) {
  authToken = token;
}

export function getActiveActor() {
  return { userId: activeUserId, roleCode: activeRoleCode };
}

// Request interceptor: gắn headers user context
apiClient.interceptors.request.use((config) => {
  config.headers["x-user-id"] = activeUserId;
  config.headers["x-role-code"] = activeRoleCode;

  if (authToken) {
    config.headers["Authorization"] = `Bearer ${authToken}`;
  }

  return config;
});

// Response interceptor: unwrap data hoặc chuẩn hóa lỗi thân thiện
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 1. Phản hồi có chứa lỗi từ Backend API
    if (error.response?.data) {
      const beData = error.response.data;
      const message =
        beData.message ||
        beData.error?.message ||
        "Yêu cầu không thể thực hiện";

      return Promise.reject({
        success: false,
        status: error.response.status,
        code: beData.error?.code || `HTTP_${error.response.status}`,
        message,
        details: beData.error?.details ?? null,
      });
    }

    // 2. Lỗi mạng hoặc kết nối máy chủ không thành công
    const isNetworkError =
      error.code === "ERR_NETWORK" ||
      error.code === "ECONNREFUSED" ||
      error.message?.includes("Network Error") ||
      !error.response;

    if (isNetworkError) {
      return Promise.reject({
        success: false,
        status: 0,
        code: "ERR_NETWORK",
        message: "Không thể kết nối đến máy chủ Backend (port 3001). Vui lòng kiểm tra lại dịch vụ Backend.",
        details: error.message,
      });
    }

    // 3. Các lỗi khác
    return Promise.reject({
      success: false,
      status: error.response?.status || 500,
      code: error.code || "UNKNOWN_ERROR",
      message: error.message || "Đã xảy ra lỗi không mong muốn",
      details: null,
    });
  }
);
