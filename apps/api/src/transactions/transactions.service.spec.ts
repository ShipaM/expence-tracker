import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { Prisma } from "@repo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionsService } from "./transactions.service";

const USER_ID = "b292ff2b-db0a-44bf-aa4a-b4e6fc353283";
const TX_ID = "3f0d5a1c-2b7e-4c9a-9d21-6f8b1e2a4c55";
const CATEGORY_ID = "7e143b56-d66e-4965-a103-1bd7fe02db6d";

const categoryRow = { id: CATEGORY_ID, name: "Продукты", color: "#6366f1", icon: null };

const transactionRow = {
  id: TX_ID,
  amount: new Prisma.Decimal("1234.56"),
  type: "EXPENSE" as const,
  description: null,
  date: new Date("2026-07-14T10:00:00.000Z"),
  userId: USER_ID,
  categoryId: CATEGORY_ID,
  createdAt: new Date("2026-07-14T10:00:00.000Z"),
  category: categoryRow,
};

const prismaMock = {
  client: {
    transaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
};

const queryBusMock = { execute: vi.fn() };

describe("TransactionsService", () => {
  let service: TransactionsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueryBus, useValue: queryBusMock },
      ],
    }).compile();

    service = moduleRef.get(TransactionsService);
  });

  describe("findAll", () => {
    it("сериализует amount в строку и оборачивает в { items, total, page, limit }", async () => {
      prismaMock.client.transaction.findMany.mockResolvedValue([transactionRow]);
      prismaMock.client.transaction.count.mockResolvedValue(1);

      const result = await service.findAll(USER_ID, {});

      expect(result).toMatchObject({ total: 1, page: 1, limit: 20 });
      const [transaction] = result.items;
      expect(transaction?.amount).toBe("1234.56");
      expect(typeof transaction?.amount).toBe("string");
      expect(transaction?.category).toEqual(categoryRow);
    });

    it("строит where из фильтров: type, categoryId и диапазон дат", async () => {
      prismaMock.client.transaction.findMany.mockResolvedValue([]);
      prismaMock.client.transaction.count.mockResolvedValue(0);

      await service.findAll(USER_ID, {
        type: "INCOME",
        categoryId: CATEGORY_ID,
        dateFrom: "2026-07-01T00:00:00.000Z",
        dateTo: "2026-07-31T23:59:59.000Z",
      });

      const args = prismaMock.client.transaction.findMany.mock.calls[0]?.[0];
      expect(args.where).toEqual({
        userId: USER_ID,
        type: "INCOME",
        categoryId: CATEGORY_ID,
        date: {
          gte: new Date("2026-07-01T00:00:00.000Z"),
          lte: new Date("2026-07-31T23:59:59.000Z"),
        },
      });
      expect(args.orderBy).toEqual({ date: "desc" });
      // count фильтрует по тому же where, что и выборка.
      expect(prismaMock.client.transaction.count.mock.calls[0]?.[0].where).toEqual(args.where);
    });

    it("не добавляет date в where без dateFrom/dateTo", async () => {
      prismaMock.client.transaction.findMany.mockResolvedValue([]);
      prismaMock.client.transaction.count.mockResolvedValue(0);

      await service.findAll(USER_ID, { type: "EXPENSE" });

      const args = prismaMock.client.transaction.findMany.mock.calls[0]?.[0];
      expect(args.where).not.toHaveProperty("date");
    });

    it("переводит page/limit в skip/take и возвращает их в ответе", async () => {
      prismaMock.client.transaction.findMany.mockResolvedValue([]);
      prismaMock.client.transaction.count.mockResolvedValue(25);

      const result = await service.findAll(USER_ID, { page: 3, limit: 10 });

      const args = prismaMock.client.transaction.findMany.mock.calls[0]?.[0];
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
      expect(result).toMatchObject({ total: 25, page: 3, limit: 10 });
    });
  });

  describe("findOne", () => {
    it("бросает 404, если транзакция принадлежит другому пользователю", async () => {
      prismaMock.client.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne(USER_ID, TX_ID)).rejects.toThrow(NotFoundException);
    });

    it("ищет с фильтром по userId, а не только по id", async () => {
      prismaMock.client.transaction.findFirst.mockResolvedValue(transactionRow);

      await service.findOne(USER_ID, TX_ID);

      const args = prismaMock.client.transaction.findFirst.mock.calls[0]?.[0];
      expect(args.where).toEqual({ id: TX_ID, userId: USER_ID });
    });
  });

  describe("create", () => {
    const dto = {
      amount: "1234.56",
      type: "EXPENSE" as const,
      date: "2026-07-14T10:00:00.000Z",
      categoryId: CATEGORY_ID,
    };

    it("проверяет пользователя и владение категорией, затем создаёт", async () => {
      queryBusMock.execute.mockResolvedValue({ id: USER_ID });
      prismaMock.client.category.findFirst.mockResolvedValue(categoryRow);
      prismaMock.client.transaction.create.mockResolvedValue(transactionRow);

      await service.create(USER_ID, dto);

      expect(queryBusMock.execute).toHaveBeenCalledOnce();
      const args = prismaMock.client.transaction.create.mock.calls[0]?.[0];
      expect(args.data).toMatchObject({
        userId: USER_ID,
        amount: "1234.56",
        type: "EXPENSE",
        categoryId: CATEGORY_ID,
        description: null,
      });
      expect(args.data.date).toEqual(new Date(dto.date));
    });

    it("бросает 401, если пользователь не найден, и не пишет в БД", async () => {
      queryBusMock.execute.mockResolvedValue(null);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.client.transaction.create).not.toHaveBeenCalled();
    });

    it("бросает 404, если категория не принадлежит пользователю", async () => {
      queryBusMock.execute.mockResolvedValue({ id: USER_ID });
      prismaMock.client.category.findFirst.mockResolvedValue(null);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(NotFoundException);
      expect(prismaMock.client.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("не трогает поля, которых нет в DTO", async () => {
      prismaMock.client.transaction.findFirst.mockResolvedValue(transactionRow);
      prismaMock.client.transaction.update.mockResolvedValue(transactionRow);

      await service.update(USER_ID, TX_ID, { amount: "10.00" });

      const args = prismaMock.client.transaction.update.mock.calls[0]?.[0];
      expect(args.data).toEqual({ amount: "10.00" });
    });

    it("проверяет владение новой категорией", async () => {
      prismaMock.client.transaction.findFirst.mockResolvedValue(transactionRow);
      prismaMock.client.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(USER_ID, TX_ID, { categoryId: CATEGORY_ID }),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.client.transaction.update).not.toHaveBeenCalled();
    });

    it("бросает 404 до попытки записи", async () => {
      prismaMock.client.transaction.findFirst.mockResolvedValue(null);

      await expect(service.update(USER_ID, TX_ID, { amount: "10.00" })).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.client.transaction.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("удаляет существующую транзакцию", async () => {
      prismaMock.client.transaction.findFirst.mockResolvedValue(transactionRow);
      prismaMock.client.transaction.delete.mockResolvedValue(transactionRow);

      await service.remove(USER_ID, TX_ID);

      expect(prismaMock.client.transaction.delete).toHaveBeenCalledWith({ where: { id: TX_ID } });
    });

    it("не удаляет чужую транзакцию", async () => {
      prismaMock.client.transaction.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, TX_ID)).rejects.toThrow(NotFoundException);
      expect(prismaMock.client.transaction.delete).not.toHaveBeenCalled();
    });
  });

  describe("summary", () => {
    it("считает income, expense, balance и разбивку по категориям", async () => {
      prismaMock.client.transaction.groupBy
        .mockResolvedValueOnce([
          { type: "INCOME", _sum: { amount: new Prisma.Decimal("5000") } },
          { type: "EXPENSE", _sum: { amount: new Prisma.Decimal("3200") } },
        ])
        .mockResolvedValueOnce([
          { categoryId: CATEGORY_ID, type: "EXPENSE", _sum: { amount: new Prisma.Decimal("3200") } },
        ]);
      prismaMock.client.category.findMany.mockResolvedValue([{ id: CATEGORY_ID, name: "Продукты" }]);

      const result = await service.summary(USER_ID, 7, 2026);

      expect(result).toEqual({
        income: "5000.00",
        expense: "3200.00",
        balance: "1800.00",
        byCategory: [
          { categoryId: CATEGORY_ID, name: "Продукты", type: "EXPENSE", total: "3200.00" },
        ],
      });
    });

    it("считает пустой месяц нулями", async () => {
      prismaMock.client.transaction.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prismaMock.client.category.findMany.mockResolvedValue([]);

      const result = await service.summary(USER_ID, 1, 2026);

      expect(result).toEqual({ income: "0.00", expense: "0.00", balance: "0.00", byCategory: [] });
    });

    it("фильтрует по полуинтервалу месяца в UTC", async () => {
      prismaMock.client.transaction.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prismaMock.client.category.findMany.mockResolvedValue([]);

      await service.summary(USER_ID, 7, 2026);

      const args = prismaMock.client.transaction.groupBy.mock.calls[0]?.[0];
      expect(args.where.date).toEqual({
        gte: new Date(Date.UTC(2026, 6, 1)),
        lt: new Date(Date.UTC(2026, 7, 1)),
      });
    });
  });
});
