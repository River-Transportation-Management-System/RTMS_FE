# RTMS Frontend

Giao diện web Next.js cho ba actor trong báo cáo: **Chủ hàng (CargoOwner)**,
**Cảng (Port Staff)** và **Chủ tàu (VesselOwner)**. Project này chỉ hiển thị
UI, thu thập input và gọi Backend API; không chứa business rules hoặc truy vấn
database.

Vai trò hệ thống lấy từ bảng `Role` / `User` trên backend. Schema đầy đủ nằm
trong repo `RTMS_BE/database/migrations/000_schema_overview.md`.

## Chạy project

Yêu cầu Node.js 24+ và npm 11+. Backend phải chạy tại
<http://localhost:3001> (hoặc đổi `NEXT_PUBLIC_API_URL`).

```bash
cp .env.example .env.local
npm install
npm run dev
```

Mở <http://localhost:3000>.

```bash
npm run lint
npm run typecheck
npm run build
npm start
```

Lưu ý:

- Dùng `.env.local` cho `npm run dev` (không commit file này).
- Hiện chỉ có khung UI (`/`, `/cargo-owner`, `/port`, `/vessel-owner`); chưa gọi
  nghiệp vụ vì API backend chưa implement.
- Chạy full stack bằng Docker: xem `RTMS_BE/README.md`.

## Cấu trúc source

```text
src/
├── app/
│   ├── (auth)/                     # Đăng nhập / khôi phục tài khoản
│   ├── (dashboard)/
│   │   ├── cargo-owner/            # Chủ hàng — Booking, Shipment
│   │   ├── port/                   # Cảng — review, điều phối, xác nhận
│   │   └── vessel-owner/           # Chủ tàu — tàu, request/response
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   ├── layout/
│   ├── booking/
│   ├── vessel/
│   ├── shipment/
│   ├── map/                        # Leaflet + Port.port_geo
│   ├── forms/
│   └── shared/
├── features/
│   └── <feature>/
├── hooks/
├── lib/
│   ├── api/
│   ├── auth/
│   ├── validation/
│   └── constants/
└── types/                          # Type khớp response API / schema
```

Thư mục chưa có file sẽ được tạo khi bắt đầu chức năng; không tạo folder rỗng.

URL hiện tại (route group `(dashboard)` không xuất hiện trên URL):

- `/` — landing
- `/cargo-owner` — không gian Chủ hàng
- `/port` — không gian Cảng
- `/vessel-owner` — không gian Chủ tàu

## Viết code mới ở đâu?

- Trang/URL mới: `src/app/<route>/page.tsx`
- Layout nhóm trang: `src/app/<route>/layout.tsx`
- UI dùng chung: `src/components/ui`
- Component booking/shipment/map: thư mục tương ứng trong `components`
- Use case UI: `src/features/<feature>`
- Gọi API: `src/lib/api`
- Type dùng chung: `src/types`
- Validate form: `src/lib/validation`

Ví dụ tạo booking:

```text
src/app/(dashboard)/cargo-owner/bookings/new/page.tsx
src/features/create-booking/
├── components/booking-form.tsx
├── hooks/use-create-booking.ts
└── api/create-booking.ts
src/lib/validation/booking.ts
src/types/booking.ts
```

## Ánh xạ UI với schema và module

- Đăng nhập/phân quyền → `User`, `Role`, module `auth`
- Hồ sơ Chủ hàng → `CargoOwner`, module `cargo-owners`
- Tạo/xem booking → `Booking`, `Route`, `RoutePort`, module `bookings`
- Cảng review/xác nhận → `BookingReview`, `Port`, module `booking-reviews`
- Chủ tàu quản lý tàu → `VesselOwner`, `Vessel`, module `vessels`
- Accept/reject → `VesselRequest`, `VesselResponse`, module `vessels`
- Chọn tàu → `BookingVesselSelection`, module `bookings`
- Theo dõi chuyến → `Shipment`, module `shipments`
- Bản đồ cảng → `Port.port_geo`, module `routes`

Chín bảng đầu là schema lõi do team cung cấp. Các bảng liên quan tàu,
workflow, rule, audit và notification là phần mở rộng bắt buộc để khớp báo cáo;
xem tài liệu schema trong repo backend.

## Quy tắc App Router

- Mặc định Server Component.
- Chỉ thêm `"use client"` khi cần state, effect hoặc browser API.
- Không import Leaflet trong Server Component; dùng dynamic Client Component.
- Không để secret trong biến `NEXT_PUBLIC_*`.
- Dùng `loading.tsx` / `error.tsx` khi cần.

## Biến môi trường

- `NEXT_PUBLIC_APP_NAME`: tên hiển thị.
- `NEXT_PUBLIC_API_URL`: base URL Backend API.

Sao chép `.env.example` thành `.env.local`; không commit `.env.local`.

## Docker

Docker Compose nằm trong `RTMS_BE`. Clone `RTMS_FE` cạnh `RTMS_BE`, rồi:

```bash
cd ../RTMS_BE
docker compose up --build frontend
```

Production image dùng Next.js standalone, cổng `3000`.
