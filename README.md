# 🌊 RTMS_FE — FRONTEND WEB APPLICATION
> **Giao Diện Web Điều Hành Vận Tải Đường Thủy RTMS Cho 4 Phân Hệ Cô Lập**

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Build Status](https://img.shields.io/badge/Build-100%25%20Passed-brightgreen?style=for-the-badge)

---

## 📌 1. TỔNG QUAN PHÂN HỆ FRONTEND

`RTMS_FE` là giao diện người dùng chính của hệ thống RTMS, được xây dựng trên nền tảng **Next.js 16 (App Router, TypeScript)** và **TailwindCSS**, cung cấp trải nghiệm điều hành trực quan cho cả 4 vai trò trong chuỗi logistics đường thủy: **Khách hàng**, **Ban Quản lý Cảng**, **Chủ phương tiện** và **Quản trị viên**.

Giao diện được thiết kế chuẩn mực theo tông màu biển **Maritime Cyan Palette**, tích hợp font chữ hiện đại, luồng làm việc 6 bước khép kín, hệ thống thông báo **Realtime Toast Notifications** và cơ chế **Smart Mock Fallback Engine** cho phép vận hành mượt mà ở cả 2 chế độ Online và Offline.

---

## 🏛️ 2. CẤU TRÚC MÃ NGUỒN (FRONTEND ARCHITECTURE)

```text
RTMS_FE/
├── Dockerfile                 # Multi-stage Dockerfile cho Frontend App (Port 3000)
├── src/
│   ├── app/                   # App Router Pages & Layouts
│   │   ├── page.tsx           # Landing Portal cho 4 phân hệ
│   │   ├── login/page.tsx     # Trang Đăng nhập & Chọn tài khoản Demo 1-click
│   │   └── dashboard/         # 4 Giao diện Phân hệ Cô lập
│   │       ├── customer/      # Giao diện Khách hàng (User #2)
│   │       ├── port/          # Giao diện Ban Quản lý Cảng (User #11)
│   │       ├── vessel/        # Giao diện Chủ phương tiện (User #16)
│   │       └── admin/         # Giao diện Quản trị viên (User #1)
│   ├── components/            # Reusable UI Components
│   │   ├── auth/              # RoleGuard (Bảo vệ đường dẫn theo vai trò)
│   │   ├── common/            # NotificationToast (Realtime Toast Hub)
│   │   └── layout/            # Header, Sidebar (Smooth Scrolling Navigation)
│   └── lib/                   # Business Logic & Client State
│       ├── api-client.ts      # Axios Client + Smart Mock Fallback Engine (0 lỗi Network Error)
│       ├── auth-context.tsx   # Quản lý phiên đăng nhập & phân quyền người dùng
│       ├── realtime.ts        # Realtime Event Emitter Hub
│       └── services/          # Service layer kết nối REST APIs (auth, booking, port, user, vessel, workflow)
├── REPORT.md                  # Báo cáo thiết kế Giao diện Frontend (Maritime Cyan Palette)
└── README.md                  # Hướng dẫn chi tiết cho Frontend Application
```

---

## 🎨 3. QUY CHUẨN THIẾT KẾ (DESIGN SYSTEM & TYPOGRAPHY)

- **Bảng màu chủ đạo Maritime Cyan**:
  - `#CBF1F5` (Soft Powder Cyan) — Nền thẻ Card, soft hover & badge tint.
  - `#A6E3E9` (Soft Aqua Blue) — Đường viền UI border & nút phụ.
  - `#71C9CE` (Vibrant Ocean Teal) — Màu nhận diện thương hiệu chủ đạo & nút chính.
  - `#0F4C5C` (Deep Teal) & `#142834` (Deep Ocean Slate) — Màu chữ tiêu đề & thanh điều hướng.
- **Font chữ Google Fonts**: **`Outfit`** (Tiêu đề & Heading) và **`Plus Jakarta Sans`** (Nội dung & Thông số).
- **RoleGuard Protection**: Tự động chặn và chuyển hướng nếu tài khoản cố tình truy cập sai phân hệ giao diện.
- **Cơ chế Standalone Dual Mode**: Tự động chuyển đổi giữa **Online Mode** (REST APIs thật) và **Offline Standalone Mode** (Smart Mock Fallback Engine, 0 lỗi Network Error).

---

## 👥 4. KIẾN TRÚC GIAO DIỆN 4 PHÂN QUYỀN (ROLE DASHBOARDS)

1. 📦 **Khách hàng (`CUSTOMER`)** — `/dashboard/customer`: Đặt đơn vận tải mới, theo dõi quy trình 6 bước realtime, chốt lựa chọn tàu ứng viên.
2. ⚓ **Ban Quản lý Cảng (`PORT_MANAGER`)** — `/dashboard/port`: Duyệt điều kiện bốc xếp Cảng đi/đến, chốt hợp đồng chuyến cuối và hiển thị bản đồ tọa độ PostGIS GeoJSON Point.
3. 🚢 **Chủ Phương tiện (`VESSEL_OWNER`)** — `/dashboard/vessel`: Hộp thư nhận đề xuất ghép chuyến (Duyệt/Từ chối), bật/tắt trạng thái đội tàu `ACTIVE`/`INACTIVE`.
4. ⚙️ **Trung tâm Điều hành (`ADMIN`)** — `/dashboard/admin`: Giám sát KPIs hệ thống, máy trạng thái State Machine, kích hoạt n8n jobs và Event Bus live stream.

---

## 🔑 5. TÀI KHOẢN TRẢI NGHIỆM NHANH (QUICK DEMO ACCOUNTS)

Truy cập trang đăng nhập tại `/login` và chọn 1-click vào tài khoản mẫu:

| Vai Trò | Email Đăng Nhập | Mật Khẩu | Phân Hệ Được Cấp Phép | ID Mẫu |
| :--- | :--- | :--- | :--- | :--- |
| 📦 **Khách Hàng** | `customer@vesseapp.vn` | `123456` | `/dashboard/customer` | User #2 |
| ⚓ **Quản Lý Cảng** | `catlai@port.vn` | `123456` | `/dashboard/port` | User #11 |
| 🚢 **Chủ Phương Tiện** | `songviet01@vessel.vn` | `123456` | `/dashboard/vessel` | User #16 |
| ⚙️ **Quản Trị Viên** | `admin@vesseapp.vn` | `123456` | `/dashboard/admin` | User #1 |

---

## 🚀 6. HƯỚNG DẪN KHỞI CHẠY (GETTING STARTED)

### 1. Khởi chạy với Docker Compose (Khuyên dùng)
```bash
# Từ thư mục gốc dự án River_Management:
docker compose up --build -d rtms_frontend
# Giao diện Web chạy tại: http://localhost:3000
```

### 2. Khởi chạy Thủ công
```bash
npm install
npm run dev
# Giao diện Web chạy tại: http://localhost:3000
```

### 3. Kiểm tra Biên dịch Production Build (100% Passed)
```bash
npm run build
```

Báo cáo chi tiết xem tại: [`REPORT.md`](REPORT.md).
