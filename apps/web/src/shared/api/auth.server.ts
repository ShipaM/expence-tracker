import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AuthResponseDto } from "@repo/shared";

import { SESSION_COOKIE, sessionCookieOptions } from "@/shared/config/cookie";
import { nestFetch } from "./nest";

/**
 * BFF-прокси login/register: тело клиента → Nest. При успехе кладёт accessToken
 * в httpOnly-куку и отдаёт наружу только { user } (токен в JS не утекает).
 * При ошибке пробрасывает статус и тело Nest (401/409/400) как есть.
 */
export async function proxyAuth(
  path: "/auth/login" | "/auth/register",
  body: unknown,
): Promise<NextResponse> {
  const response = await nestFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  const { accessToken, user } = data as AuthResponseDto;
  (await cookies()).set(SESSION_COOKIE, accessToken, sessionCookieOptions());
  return NextResponse.json({ user }, { status: response.status });
}
