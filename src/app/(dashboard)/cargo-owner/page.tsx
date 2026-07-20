import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function CargoOwnerPage() {
  return (
    <ModulePlaceholder
      title="Không gian Chủ hàng"
      description="Nơi phát triển giao diện tạo booking, theo dõi review cảng và shipment."
      plannedFeatures={[
        "Quản lý hồ sơ CargoOwner",
        "Tạo booking theo Route",
        "Theo dõi BookingReview và Shipment",
      ]}
    />
  );
}
