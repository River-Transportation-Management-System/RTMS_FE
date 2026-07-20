import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function VesselOwnerPage() {
  return (
    <ModulePlaceholder
      title="Không gian Chủ tàu"
      description="Nơi phát triển giao diện quản lý tàu và phản hồi yêu cầu vận chuyển."
      plannedFeatures={[
        "Quản lý hồ sơ và trạng thái tàu",
        "Khai báo loại hàng và sức chứa",
        "Accept/reject yêu cầu vận chuyển",
      ]}
    />
  );
}
