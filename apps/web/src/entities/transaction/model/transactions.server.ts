import "server-only";

import { cookies } from "next/headers";
import type { PaginatedTransactionsDto } from "@repo/shared";

import { nestJson } from "@/shared/api/nest";
import { SESSION_COOKIE } from "@/shared/config/cookie";

interface GetTransactionsParams {
  page?: number;
  limit?: number;
}

/**
 * Пагинированный список транзакций текущего пользователя. Только сервер.
 * Токен берётся из httpOnly-куки и уходит в Authorization: Bearer (в JS не утекает).
 * Вызывается на уже гейтнутой странице (getSession прошёл), поэтому кука валидна.
 */
export async function getTransactions({
  page = 1,
  limit = 10,
}: GetTransactionsParams = {}): Promise<PaginatedTransactionsDto> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return nestJson<PaginatedTransactionsDto>(`/transactions?${query}`, { token });
}
