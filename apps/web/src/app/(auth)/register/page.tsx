import { redirect } from "next/navigation";

import { getSession } from "@/entities/session/server";
import { RegisterPage } from "@/views/register";

// Залогиненного уводим на главную — гард на странице, см. login/page.tsx.
export default async function Page() {
  if (await getSession()) redirect("/");
  return <RegisterPage />;
}
