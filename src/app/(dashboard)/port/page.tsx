import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function PortPage() {
  return (
    <ModulePlaceholder
      title="Không gian Cảng"
      description="Nơi phát triển giao diện quản lý cảng và xét duyệt booking."
      plannedFeatures={[
        "Xem booking theo RoutePort",
        "Tạo/cập nhật BookingReview",
        "Theo dõi shipment sau khi duyệt",
      ]}
    />
  );
}
