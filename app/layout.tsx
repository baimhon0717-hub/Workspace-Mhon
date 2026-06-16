import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routine Plan69 Tracker",
  description: "ระบบติดตามงานประจำทีมจาก Routine Plan69",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
