import { redirect } from "next/navigation";

import { getSession } from "@/entities/session/server";
import { HomePage } from "@/views/home";

/**
 * Главный экран. Гейт по getSession() (источник истины, как в гардах /login и /register):
 * гостя уводим на /login. Пагинация списка — через ?page=N (серверный перефетч).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await getSession())) redirect("/login");

  const page = Math.max(1, Number((await searchParams).page) || 1);
  return <HomePage page={page} />;
}
