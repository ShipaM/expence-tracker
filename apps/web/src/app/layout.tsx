import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Трекер расходов",
  description: "Учёт доходов и расходов",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
