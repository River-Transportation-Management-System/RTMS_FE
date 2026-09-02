import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Roboto } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";

import "./globals.css";

const roboto = Roboto({
  weight: ["300", "400", "500", "700", "900"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "RTMS - Hệ thống Quản lý Vận tải Đường thủy Nội địa",
  description: "Hệ thống Quản lý Vận tải Đường thủy Nội địa Việt Nam",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" className={roboto.variable}>
      <body className={roboto.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
