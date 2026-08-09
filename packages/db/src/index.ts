/**
 * Публичная поверхность `@repo/db`: фабрика клиента плюс всё, что сгенерировал Prisma
 * (модели `User`, `Category`, `Transaction`, enum `TransactionType`, namespace `Prisma`).
 *
 * Импорты внутри пакета пишутся с расширением `.js`, хотя файлы — `.ts`: генератор настроен
 * на `moduleFormat = "cjs"` и `importFileExtension = "js"` ради потребителя на CommonJS.
 * Папка `src/generated` не хранится в git — пересоздаётся через `npm run db:generate`.
 */
export { createPrismaClient, PrismaClient } from "./client.js";
export * from "./generated/client.js";
