import "server-only";

import { cookies } from "next/headers";
import type { UserDto } from "@repo/shared";

import { nestJson } from "@/shared/api/nest";
import { SESSION_COOKIE } from "@/shared/config/cookie";

/**
 * Текущий пользователь по httpOnly-куке. Только сервер.
 * Токен из куки валидируется реальным запросом к Nest `/auth/me`
 * (юзер мог быть удалён, пока жив 7-дневный токен) → UserDto либо null.
 */
export async function getSession(): Promise<UserDto | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await nestJson<UserDto>("/auth/me", { token });
  } catch {
    return null;
  }
}
