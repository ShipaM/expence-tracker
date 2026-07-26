import { z } from "zod";

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const createCategorySchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ожидается HEX-цвет вида #a1b2c3"),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export interface CategoryDto {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

// Транзакции валидируются class-validator DTO в apps/api, поэтому здесь только типы ответа.
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

export const registerSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(120),
  // 72 — предел bcrypt: байты сверх обрезаются, поэтому длиннее не принимаем.
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResponseDto {
  accessToken: string;
  user: UserDto;
}
