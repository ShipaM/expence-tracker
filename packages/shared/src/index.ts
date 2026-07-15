import { z } from "zod";

export const EXPENSE_TYPES = ["INCOME", "EXPENSE"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const createExpenseSchema = z.object({
  title: z.string().min(1).max(120),
  // Сумма приходит строкой: Prisma хранит Decimal, а JSON-число теряет точность.
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Ожидается сумма вида 1234.56"),
  type: z.enum(EXPENSE_TYPES).default("EXPENSE"),
  spentAt: z.iso.datetime(),
  categoryId: z.uuid().optional(),
  note: z.string().max(500).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ожидается HEX-цвет вида #a1b2c3"),
});

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof updateExpenseSchema>;
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export interface ExpenseDto {
  id: string;
  title: string;
  amount: string;
  type: ExpenseType;
  spentAt: string;
  note: string | null;
  category: CategoryDto | null;
  createdAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  color: string;
}
