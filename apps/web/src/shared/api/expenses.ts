import type { CreateExpenseDto, ExpenseDto } from "@repo/shared";

import { nestJson } from "./nest";

// TODO: перевести с ?userId= на Bearer-токен из сессии (см. план web-auth-fsd).
// Пока функции перенесены из старого lib/api.ts без изменения логики и нигде не используются.
export const expensesApi = {
  listExpenses: (userId: string) =>
    nestJson<ExpenseDto[]>(`/expenses?userId=${userId}`),

  createExpense: (userId: string, dto: CreateExpenseDto) =>
    nestJson<ExpenseDto>(`/expenses?userId=${userId}`, {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  deleteExpense: (userId: string, id: string) =>
    nestJson<void>(`/expenses/${id}?userId=${userId}`, { method: "DELETE" }),
};
