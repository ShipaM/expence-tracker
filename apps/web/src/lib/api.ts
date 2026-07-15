import type { CreateExpenseDto, ExpenseDto } from "@repo/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Запрос ${path} завершился со статусом ${response.status}`);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  listExpenses: (userId: string) =>
    request<ExpenseDto[]>(`/expenses?userId=${userId}`),

  createExpense: (userId: string, dto: CreateExpenseDto) =>
    request<ExpenseDto>(`/expenses?userId=${userId}`, {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  deleteExpense: (userId: string, id: string) =>
    request<void>(`/expenses/${id}?userId=${userId}`, { method: "DELETE" }),
};
