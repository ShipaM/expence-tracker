import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";

/**
 * Создаёт клиент Prisma с driver adapter — единственная точка создания клиента в проекте.
 *
 * Prisma 7 требует driver adapter: `new PrismaClient()` без него не инициализируется.
 * В development включается лог запросов, иначе только ошибки.
 *
 * @param connectionString Строка подключения; по умолчанию `DATABASE_URL` из окружения.
 *   В Prisma 7 её нет в схеме — она задаётся в `prisma.config.ts` и здесь.
 * @returns Готовый к работе клиент; соединение открывается отдельно (`$connect`).
 * @throws {Error} Строка подключения пуста — ни аргумента, ни `DATABASE_URL`.
 */
export function createPrismaClient(
  connectionString: string | undefined = process.env.DATABASE_URL,
): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL не задан");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

export { PrismaClient };
