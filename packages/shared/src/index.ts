import { z } from "zod";

/**
 * Типы и схемы, общие для фронтенда и бэкенда (`@repo/shared`).
 *
 * zod-схемы переиспользуются обоими приложениями: в Nest — через `ZodValidationPipe`,
 * на фронте — через `zodResolver`. Интерфейсы описывают формы ответов API.
 */

/** Допустимые типы операции; дублирует enum `TransactionType` из Prisma без зависимости от БД. */
export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;

/** Тип операции: доход или расход. */
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Схема тела для создания категории. */
export const createCategorySchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ожидается HEX-цвет вида #a1b2c3"),
});

/** Данные для создания категории, выведенные из {@link createCategorySchema}. */
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

/** Категория в ответе API. */
export interface CategoryDto {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

/**
 * Транзакция в ответе API.
 *
 * Транзакции валидируются class-validator DTO в apps/api, поэтому здесь только типы ответа.
 * `date` и `createdAt` — строки ISO-8601.
 */
export interface TransactionDto {
  id: string;
  // Сумма отдаётся строкой: Prisma хранит Decimal, а JSON-число теряет точность на копейках.
  amount: string;
  type: TransactionType;
  description: string | null;
  date: string;
  category: CategoryDto;
  createdAt: string;
}

/** Пагинированный список транзакций: обёртка над items + метаданные страницы. */
export interface PaginatedTransactionsDto {
  items: TransactionDto[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Итоги за месяц: суммы — строки (`Decimal.toFixed(2)`), `balance` = `income - expense`.
 * В `byCategory` по строке на пару «категория + тип».
 */
export interface TransactionSummaryDto {
  income: string;
  expense: string;
  balance: string;
  byCategory: {
    categoryId: string;
    name: string;
    type: TransactionType;
    total: string;
  }[];
}

/**
 * Схема тела регистрации.
 *
 * Верхняя граница пароля не декоративная: 72 — предел bcrypt, байты сверх обрезаются молча,
 * поэтому длиннее не принимаем.
 */
export const registerSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(72),
});

/** Схема тела входа: пароль здесь только на непустоту — длину проверяли при регистрации. */
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/** Данные регистрации, выведенные из {@link registerSchema}. */
export type RegisterDto = z.infer<typeof registerSchema>;

/** Данные входа, выведенные из {@link loginSchema}. */
export type LoginDto = z.infer<typeof loginSchema>;

/** Публичный профиль пользователя. Хэш пароля сюда не попадает и бэкенд не покидает. */
export interface UserDto {
  id: string;
  email: string;
  name: string | null;
}

/** Ответ на регистрацию и вход: токен доступа плюс профиль. */
export interface AuthResponseDto {
  accessToken: string;
  user: UserDto;
}
