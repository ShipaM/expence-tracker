import { redirect } from "next/navigation";

import { getSession } from "@/entities/session/server";
import { LoginPage } from "@/views/login";

// Залогиненного уводим на главную. Гард на самой странице (а не в proxy):
// результат ходит вместе с RSC-prefetch, поэтому навигация гостя мгновенна,
// без блокирующего сетевого вызова на каждый запрос. getSession — авторитетная
// проверка токена (/auth/me), протухшая кука не создаёт петлю редиректов.
export default async function Page() {
  if (await getSession()) redirect("/");
  return <LoginPage />;
}
