import Link from "next/link";

const roles = [
  {
    href: "/cargo-owner",
    title: "Chủ hàng",
    description: "Tạo booking, chọn tuyến và theo dõi shipment.",
  },
  {
    href: "/port",
    title: "Cảng",
    description: "Xét duyệt booking và quản lý thông tin cảng.",
  },
  {
    href: "/vessel-owner",
    title: "Chủ tàu",
    description: "Quản lý tàu và phản hồi yêu cầu vận chuyển.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-sky-700">RTMS Prototype</p>
      <h1 className="mt-3 text-4xl font-bold">Điều phối vận tải hàng hóa đường thủy</h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        Khung giao diện cho Chủ hàng, Cảng và Chủ tàu theo báo cáo RTMS.
      </p>
      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {roles.map((role) => (
          <Link
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-600"
            href={role.href}
            key={role.href}
          >
            <h2 className="text-xl font-semibold">{role.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{role.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
