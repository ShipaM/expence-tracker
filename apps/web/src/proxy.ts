import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/shared/config/cookie";

// Next 16: конвенция proxy (бывш. middleware).
// Залогиненного (есть кука сессии) уводим со страниц входа/регистрации на главную.
// Защиту приватных маршрутов добавим отдельно, когда они появятся.
export default function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/register"],
};
