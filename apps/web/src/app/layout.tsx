import type { Metadata } from "next";
import "./globals.css";

import { SessionProvider } from "@/entities/session";
import { getSession } from "@/entities/session/server";

export const metadata: Metadata = {
  title: "Трекер расходов",
  description: "Учёт доходов и расходов",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSession();

  return (
    <html lang="ru">
      <body>
        <SessionProvider user={user}>{children}</SessionProvider>
      </body>
    </html>
  );
}
