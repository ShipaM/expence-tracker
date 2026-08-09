import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { Prisma } from "@repo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { addPeriod, PaymentsService } from "./payments.service";

const USER_ID = "b292ff2b-db0a-44bf-aa4a-b4e6fc353283";
const PAYMENT_ID = "0c4f7a21-8b6d-4e93-a5f1-7d2c9e0b3a68";
const CATEGORY_ID = "7e143b56-d66e-4965-a103-1bd7fe02db6d";
const TX_ID = "3f0d5a1c-2b7e-4c9a-9d21-6f8b1e2a4c55";

const categoryRow = { id: CATEGORY_ID, name: "Подписки", color: "#6366f1", icon: null };

const paymentRow = {
  id: PAYMENT_ID,
  name: "Подписка на музыку",
  amount: new Prisma.Decimal("299.00"),
  type: "EXPENSE" as const,
  period: "MONTHLY" as const,
  nextDueDate: new Date("2026-09-01T00:00:00.000Z"),
  isActive: true,
  description: null,
  userId: USER_ID,
  categoryId: CATEGORY_ID,
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  updatedAt: new Date("2026-08-01T10:00:00.000Z"),
  category: categoryRow,
};

const transactionRow = {
  id: TX_ID,
  amount: new Prisma.Decimal("299.00"),
  type: "EXPENSE" as const,
  description: "Подписка на музыку",
  date: new Date("2026-09-01T00:00:00.000Z"),
  userId: USER_ID,
  categoryId: CATEGORY_ID,
  createdAt: new Date("2026-09-02T08:00:00.000Z"),
  category: categoryRow,
};

const prismaMock = {
  client: {
    payment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
};

const queryBusMock = { execute: vi.fn() };

describe("addPeriod", () => {
  it("прибавляет 7 дней для недельного периода", () => {
    const result = addPeriod(new Date("2026-09-01T00:00:00.000Z"), "WEEKLY");

    expect(result.toISOString()).toBe("2026-09-08T00:00:00.000Z");
  });

  it("прибавляет месяц, квартал и год", () => {
    const date = new Date("2026-01-15T09:30:00.000Z");

    expect(addPeriod(date, "MONTHLY").toISOString()).toBe("2026-02-15T09:30:00.000Z");
    expect(addPeriod(date, "QUARTERLY").toISOString()).toBe("2026-04-15T09:30:00.000Z");
    expect(addPeriod(date, "YEARLY").toISOString()).toBe("2027-01-15T09:30:00.000Z");
  });

  it("прижимает 31-е к последнему дню короткого месяца, а не переносит на следующий", () => {
    // Наивный setUTCMonth дал бы 3 марта — платёж уехал бы на месяц вперёд.
    expect(addPeriod(new Date("2026-01-31T00:00:00.000Z"), "MONTHLY").toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });

  it("учитывает високосный февраль", () => {
    expect(addPeriod(new Date("2028-01-31T00:00:00.000Z"), "MONTHLY").toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });

  it("переходит через год для декабря", () => {
    expect(addPeriod(new Date("2026-12-10T00:00:00.000Z"), "MONTHLY").toISOString()).toBe(
      "2027-01-10T00:00:00.000Z",
    );
  });
});

describe("PaymentsService", () => {
  let service: PaymentsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueryBus, useValue: queryBusMock },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
  });

  describe("findAll", () => {
    it("фильтрует по userId и отдаёт суммы строками", async () => {
      prismaMock.client.payment.findMany.mockResolvedValue([paymentRow]);

      const result = await service.findAll(USER_ID, {});

      expect(prismaMock.client.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID }, orderBy: { nextDueDate: "asc" } }),
      );
      expect(result[0]?.amount).toBe("299.00");
      expect(result[0]?.category.name).toBe("Подписки");
    });

    it("применяет фильтры isActive, categoryId и dueBefore", async () => {
      prismaMock.client.payment.findMany.mockResolvedValue([]);

      await service.findAll(USER_ID, {
        isActive: false,
        categoryId: CATEGORY_ID,
        dueBefore: "2026-10-01T00:00:00.000Z",
      });

      expect(prismaMock.client.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: USER_ID,
            isActive: false,
            categoryId: CATEGORY_ID,
            nextDueDate: { lte: new Date("2026-10-01T00:00:00.000Z") },
          },
        }),
      );
    });

    it("не теряет isActive: false — оно не должно считаться отсутствующим фильтром", async () => {
      prismaMock.client.payment.findMany.mockResolvedValue([]);

      await service.findAll(USER_ID, { isActive: false });

      const call = prismaMock.client.payment.findMany.mock.calls[0]?.[0];
      expect(call.where.isActive).toBe(false);
    });
  });

  describe("upcoming", () => {
    it("берёт только активные и считает итоги по типам", async () => {
      prismaMock.client.payment.findMany.mockResolvedValue([
        paymentRow,
        { ...paymentRow, id: "other", type: "INCOME" as const, amount: new Prisma.Decimal("75000.00") },
      ]);

      const result = await service.upcoming(USER_ID, 30);

      expect(prismaMock.client.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID, isActive: true }),
        }),
      );
      expect(result.totalExpense).toBe("299.00");
      expect(result.totalIncome).toBe("75000.00");
      expect(result.items).toHaveLength(2);
    });

    it("отдаёт нули на пустом окне", async () => {
      prismaMock.client.payment.findMany.mockResolvedValue([]);

      const result = await service.upcoming(USER_ID, 7);

      expect(result).toEqual({ items: [], totalIncome: "0.00", totalExpense: "0.00" });
    });

    it("включает платежи с датой, точно совпадающей с границей окна", async () => {
      const now = Date.now();
      const days = 7;
      const exactly = new Date(now + days * 24 * 60 * 60 * 1000);

      prismaMock.client.payment.findMany.mockResolvedValue([
        { ...paymentRow, nextDueDate: exactly },
      ]);

      await service.upcoming(USER_ID, days);

      expect(prismaMock.client.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ nextDueDate: { lte: exactly } }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("бросает 404, если платежа нет или он чужой", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(null);

      await expect(service.findOne(USER_ID, PAYMENT_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.client.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: PAYMENT_ID, userId: USER_ID } }),
      );
    });

    it("отдаёт платёж с категорией и суммой строкой", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(paymentRow);

      const result = await service.findOne(USER_ID, PAYMENT_ID);

      expect(result.id).toBe(PAYMENT_ID);
      expect(result.amount).toBe("299.00");
      expect(result.category.name).toBe("Подписки");
    });
  });

  describe("create", () => {
    const dto = {
      name: "Подписка на музыку",
      amount: "299.00",
      type: "EXPENSE" as const,
      period: "MONTHLY" as const,
      nextDueDate: "2026-09-01T00:00:00.000Z",
      categoryId: CATEGORY_ID,
    };

    it("бросает 401, если пользователя из токена уже нет", async () => {
      queryBusMock.execute.mockResolvedValue(null);

      await expect(service.create(USER_ID, dto)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaMock.client.payment.create).not.toHaveBeenCalled();
    });

    it("бросает 404, если категория чужая", async () => {
      queryBusMock.execute.mockResolvedValue({ id: USER_ID });
      prismaMock.client.category.findFirst.mockResolvedValue(null);

      await expect(service.create(USER_ID, dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.client.payment.create).not.toHaveBeenCalled();
    });

    it("создаёт платёж с userId из токена", async () => {
      queryBusMock.execute.mockResolvedValue({ id: USER_ID });
      prismaMock.client.category.findFirst.mockResolvedValue(categoryRow);
      prismaMock.client.payment.create.mockResolvedValue(paymentRow);

      const result = await service.create(USER_ID, dto);

      expect(prismaMock.client.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            nextDueDate: new Date("2026-09-01T00:00:00.000Z"),
          }),
        }),
      );
      expect(result.id).toBe(PAYMENT_ID);
    });

    it("проносит необязательные поля description и isActive", async () => {
      queryBusMock.execute.mockResolvedValue({ id: USER_ID });
      prismaMock.client.category.findFirst.mockResolvedValue(categoryRow);
      prismaMock.client.payment.create.mockResolvedValue({
        ...paymentRow,
        description: "Семейная подписка",
        isActive: false,
      });

      await service.create(USER_ID, { ...dto, description: "Семейная подписка", isActive: false });

      expect(prismaMock.client.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: "Семейная подписка", isActive: false }),
        }),
      );
    });
  });

  describe("update", () => {
    it("проверяет владение новой категорией", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.client.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(USER_ID, PAYMENT_ID, { categoryId: CATEGORY_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.client.payment.update).not.toHaveBeenCalled();
    });

    it("отправляет в БД только переданные поля", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.client.payment.update.mockResolvedValue({ ...paymentRow, isActive: false });

      await service.update(USER_ID, PAYMENT_ID, { isActive: false });

      expect(prismaMock.client.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: PAYMENT_ID }, data: { isActive: false } }),
      );
    });

    it("обновляет несколько полей одновременно", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.client.payment.update.mockResolvedValue({
        ...paymentRow,
        amount: new Prisma.Decimal("399.00"),
        description: "Обновлённое описание",
      });

      const result = await service.update(USER_ID, PAYMENT_ID, {
        amount: "399.00",
        description: "Обновлённое описание",
      });

      expect(prismaMock.client.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: "399.00", description: "Обновлённое описание" }),
        }),
      );
      expect(result.amount).toBe("399.00");
    });
  });

  describe("pay", () => {
    it("бросает 404, если платежа нет или он чужой", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(null);

      await expect(service.pay(USER_ID, PAYMENT_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.client.$transaction).not.toHaveBeenCalled();
    });

    it("создаёт транзакцию и сдвигает дату одной БД-транзакцией", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.client.$transaction.mockResolvedValue([
        transactionRow,
        { ...paymentRow, nextDueDate: new Date("2026-10-01T00:00:00.000Z") },
      ]);

      const result = await service.pay(USER_ID, PAYMENT_ID);

      expect(prismaMock.client.$transaction).toHaveBeenCalledTimes(1);
      expect(result.transaction.id).toBe(TX_ID);
      expect(result.transaction.amount).toBe("299.00");
      expect(result.payment.nextDueDate).toBe("2026-10-01T00:00:00.000Z");
    });

    it("ставит транзакции плановую дату платежа, а не текущую", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.client.$transaction.mockResolvedValue([transactionRow, paymentRow]);

      await service.pay(USER_ID, PAYMENT_ID);

      // Транзакция создаётся первым аргументом $transaction — проверяем дату в её payload.
      const createCall = prismaMock.client.transaction.create.mock.calls[0]?.[0];
      expect(createCall.data.date).toEqual(paymentRow.nextDueDate);
      expect(createCall.data.userId).toBe(USER_ID);
    });

    it("подставляет имя платежа в описание, если своего описания нет", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.client.$transaction.mockResolvedValue([transactionRow, paymentRow]);

      await service.pay(USER_ID, PAYMENT_ID);

      const createCall = prismaMock.client.transaction.create.mock.calls[0]?.[0];
      expect(createCall.data.description).toBe("Подписка на музыку");
    });

    it("оставляет своё описание платежа, если оно есть", async () => {
      const paymentWithDesc = { ...paymentRow, description: "Spotify семейная" };
      prismaMock.client.payment.findFirst.mockResolvedValue(paymentWithDesc);
      prismaMock.client.$transaction.mockResolvedValue([transactionRow, paymentWithDesc]);

      await service.pay(USER_ID, PAYMENT_ID);

      const createCall = prismaMock.client.transaction.create.mock.calls[0]?.[0];
      expect(createCall.data.description).toBe("Spotify семейная");
    });
  });

  describe("remove", () => {
    it("бросает 404 и не удаляет чужой платёж", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, PAYMENT_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.client.payment.delete).not.toHaveBeenCalled();
    });

    it("удаляет платёж пользователя", async () => {
      prismaMock.client.payment.findFirst.mockResolvedValue(paymentRow);
      prismaMock.client.payment.delete.mockResolvedValue(paymentRow);

      await service.remove(USER_ID, PAYMENT_ID);

      expect(prismaMock.client.payment.delete).toHaveBeenCalledWith({ where: { id: PAYMENT_ID } });
    });
  });
});
