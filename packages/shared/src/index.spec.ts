import { describe, expect, it } from "vitest";
import { createCategorySchema, createExpenseSchema, updateExpenseSchema } from "./index";

const validExpense = {
  title: "Пятёрочка",
  amount: "1234.56",
  spentAt: "2026-07-14T10:00:00.000Z",
};

describe("createExpenseSchema", () => {
  it("принимает корректный расход и подставляет тип по умолчанию", () => {
    const result = createExpenseSchema.parse(validExpense);

    expect(result.type).toBe("EXPENSE");
    expect(result.amount).toBe("1234.56");
  });

  it.each([
    ["больше двух знаков после запятой", "10.999"],
    ["запятая вместо точки", "10,50"],
    ["отрицательная сумма", "-10.00"],
    ["не число", "десять"],
    ["пустая строка", ""],
  ])("отклоняет сумму: %s", (_, amount) => {
    expect(createExpenseSchema.safeParse({ ...validExpense, amount }).success).toBe(false);
  });

  it.each([
    ["целое число", "1000"],
    ["один знак после запятой", "10.5"],
    ["два знака после запятой", "10.50"],
    ["ноль", "0"],
  ])("принимает сумму: %s", (_, amount) => {
    expect(createExpenseSchema.safeParse({ ...validExpense, amount }).success).toBe(true);
  });

  it("отклоняет пустой заголовок", () => {
    expect(createExpenseSchema.safeParse({ ...validExpense, title: "" }).success).toBe(false);
  });

  it("отклоняет дату не в формате ISO", () => {
    expect(
      createExpenseSchema.safeParse({ ...validExpense, spentAt: "14.07.2026" }).success,
    ).toBe(false);
  });

  it("отклоняет categoryId, который не UUID", () => {
    expect(
      createExpenseSchema.safeParse({ ...validExpense, categoryId: "42" }).success,
    ).toBe(false);
  });
});

describe("updateExpenseSchema", () => {
  it("допускает частичное обновление", () => {
    expect(updateExpenseSchema.safeParse({ title: "Новый" }).success).toBe(true);
  });

  it("проверяет сумму и при частичном обновлении", () => {
    expect(updateExpenseSchema.safeParse({ amount: "10.999" }).success).toBe(false);
  });
});

describe("createCategorySchema", () => {
  it("принимает HEX-цвет", () => {
    expect(createCategorySchema.safeParse({ name: "Еда", color: "#22c55e" }).success).toBe(true);
  });

  it.each(["22c55e", "#22c5", "красный"])("отклоняет цвет %s", (color) => {
    expect(createCategorySchema.safeParse({ name: "Еда", color }).success).toBe(false);
  });
});
