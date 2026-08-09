import type { Metadata } from "next";
import { Golos_Text, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";

import { SessionProvider } from "@/entities/session";
import { getSession } from "@/entities/session/server";

// Все три семейства обязаны нести кириллицу — интерфейс русский, латиница с
// дорисованными глифами читается как чужая.
const golos = Golos_Text({
  subsets: ["cyrillic", "latin"],
  variable: "--font-golos",
  display: "swap",
});

const unbounded = Unbounded({
  subsets: ["cyrillic", "latin"],
  variable: "--font-unbounded",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["cyrillic", "latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Трекер расходов",
  description: "Учёт доходов и расходов",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSession();

  return (
    <html
      lang="ru"
      className={`${golos.variable} ${unbounded.variable} ${jetbrains.variable}`}
    >
      <body>
        <SessionProvider user={user}>{children}</SessionProvider>
      </body>
    </html>
  );
}
