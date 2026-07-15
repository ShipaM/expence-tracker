import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { ExpensesService } from "./expenses.service";

const USER_ID = "b292ff2b-db0a-44bf-aa4a-b4e6fc353283";
const EXPENSE_ID = "7e143b56-d66e-4965-a103-1bd7fe02db6d";

// Prisma отдаёт Decimal — важно, что у него есть toFixed: на этом строится сериализация.
const decimal = (value: string) => ({ toFixed: (digits: number) => Number(value).toFixed(digits) });

const expenseRow = {
  id: EXPENSE_ID,
  title: "Пятёрочка",
  amount: decimal("1234.56"),
  type: "EXPENSE" as const,
  spentAt: new Date("2026-07-14T10:00:00.000Z"),
  note: null,
  userId: USER_ID,
  categoryId: null,
  createdAt: new Date("2026-07-14T10:00:00.000Z"),
  updatedAt: new Date("2026-07-14T10:00:00.000Z"),
  category: null,
};

const prismaMock = {
  client: {
    expense: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
};

describe("ExpensesService", () => {
  let service: ExpensesService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [ExpensesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(ExpensesService);
  });

  describe("findAll", () => {
    it("отдаёт расходы пользователя, отсортированные по дате", async () => {
      prismaMock.client.expense.findMany.mockResolvedValue([expenseRow]);

      const result = await service.findAll(USER_ID);

      expect(prismaMock.client.expense.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        include: { category: true },
        orderBy: { spentAt: "desc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(EXPENSE_ID);
    });

    it("сериализует сумму строкой с двумя знаками", async () => {
      prismaMock.client.expense.findMany.mockResolvedValue([
        { ...expenseRow, amount: decimal("1000") },
      ]);

      const [expense] = await service.findAll(USER_ID);

      expect(expense?.amount).toBe("1000.00");
      expect(typeof expense?.amount).toBe("string");
    });

    it("отдаёт даты в ISO", async () => {
      prismaMock.client.expense.findMany.mockResolvedValue([expenseRow]);

      const [expense] = await service.findAll(USER_ID);

      expect(expense?.spentAt).toBe("2026-07-14T10:00:00.000Z");
    });
  });

  describe("findOne", () => {
    it("бросает 404, если расход принадлежит другому пользователю", async () => {
      prismaMock.client.expense.findFirst.mockResolvedValue(null);

      await expect(service.findOne(USER_ID, EXPENSE_ID)).rejects.toThrow(NotFoundException);
    });

    it("ищет с фильтром по userId, а не только по id", async () => {
      prismaMock.client.expense.findFirst.mockResolvedValue(expenseRow);

      await service.findOne(USER_ID, EXPENSE_ID);

      expect(prismaMock.client.expense.findFirst).toHaveBeenCalledWith({
        where: { id: EXPENSE_ID, userId: USER_ID },
        include: { category: true },
      });
    });
  });

  describe("create", () => {
    it("превращает spentAt из строки в Date", async () => {
      prismaMock.client.expense.create.mockResolvedValue(expenseRow);

      await service.create(USER_ID, {
        title: "Кофе",
        amount: "250.00",
        type: "EXPENSE",
        spentAt: "2026-07-14T10:00:00.000Z",
      });

      const args = prismaMock.client.expense.create.mock.calls[0]?.[0];
      expect(args.data.spentAt).toBeInstanceOf(Date);
      expect(args.data.userId).toBe(USER_ID);
    });
  });

  describe("update", () => {
    it("не трогает поля, которых нет в DTO", async () => {
      prismaMock.client.expense.findFirst.mockResolvedValue(expenseRow);
      prismaMock.client.expense.update.mockResolvedValue(expenseRow);

      await service.update(USER_ID, EXPENSE_ID, { title: "Новый" });

      const args = prismaMock.client.expense.update.mock.calls[0]?.[0];
      expect(args.data).toEqual({ title: "Новый" });
    });

    it("бросает 404 до попытки записи", async () => {
      prismaMock.client.expense.findFirst.mockResolvedValue(null);

      await expect(service.update(USER_ID, EXPENSE_ID, { title: "X" })).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.client.expense.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("удаляет существующий расход", async () => {
      prismaMock.client.expense.findFirst.mockResolvedValue(expenseRow);
      prismaMock.client.expense.delete.mockResolvedValue(expenseRow);

      await service.remove(USER_ID, EXPENSE_ID);

      expect(prismaMock.client.expense.delete).toHaveBeenCalledWith({ where: { id: EXPENSE_ID } });
    });

    it("не удаляет чужой расход", async () => {
      prismaMock.client.expense.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, EXPENSE_ID)).rejects.toThrow(NotFoundException);
      expect(prismaMock.client.expense.delete).not.toHaveBeenCalled();
    });
  });
});
