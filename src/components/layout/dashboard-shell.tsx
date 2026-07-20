import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/cargo-owner", label: "Chủ hàng" },
  { href: "/port", label: "Cảng" },
  { href: "/vessel-owner", label: "Chủ tàu" },
];

export function DashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link className="font-bold text-sky-800" href="/">RTMS</Link>
          <nav className="flex gap-5 text-sm">
            {navigation.map((item) => (
              <Link href={item.href} key={item.href}>{item.label}</Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
