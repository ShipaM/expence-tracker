import { Test } from "@nestjs/testing";
import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { CategoriesService } from "./categories.service";

const USER_ID = "b292ff2b-db0a-44bf-aa4a-b4e6fc353283";
const CATEGORY_ID = "7e143b56-d66e-4965-a103-1bd7fe02db6d";

const categoryRow = {
  id: CATEGORY_ID,
  name: "Продукты",
  color: "#6366f1",
  icon: null,
  userId: USER_ID,
};

// Утиный объект ошибки Prisma: сервис ловит уникальность по коду P2002.
const uniqueError = { code: "P2002" };

const prismaMock = {
  client: {
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
};

const queryBusMock = {
  execute: vi.fn(),
};

describe("CategoriesService", () => {
  let service: CategoriesService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueryBus, useValue: queryBusMock },
      ],
    }).compile();

    service = moduleRef.get(CategoriesService);
  });

  describe("findAll", () => {
    it("отдаёт категории пользователя, отсортированные по имени", async () => {
      prismaMock.client.category.findMany.mockResolvedValue([categoryRow]);

      const result = await service.findAll(USER_ID);

      expect(prismaMock.client.category.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: { name: "asc" },
      });
      expect(result).toEqual([{ id: CATEGORY_ID, name: "Продукты", color: "#6366f1", icon: null }]);
    });

    it("проносит icon в DTO", async () => {
      prismaMock.client.category.findMany.mockResolvedValue([{ ...categoryRow, icon: "cart" }]);

      const [category] = await service.findAll(USER_ID);

      expect(category?.icon).toBe("cart");
    });
  });

  describe("findOne", () => {
    it("бросает 404, если категория принадлежит другому пользователю", async () => {
      prismaMock.client.category.findFirst.mockResolvedValue(null);

      await expect(service.findOne(USER_ID, CATEGORY_ID)).rejects.toThrow(NotFoundException);
    });

    it("ищет с фильтром по userId, а не только по id", async () => {
      prismaMock.client.category.findFirst.mockResolvedValue(categoryRow);

      await service.findOne(USER_ID, CATEGORY_ID);

      expect(prismaMock.client.category.findFirst).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, userId: USER_ID },
      });
    });
  });

  describe("create", () => {
    it("проверяет существование пользователя через QueryBus", async () => {
      queryBusMock.execute.mockResolvedValue({ id: USER_ID });
      prismaMock.client.category.create.mockResolvedValue(categoryRow);

      await service.create(USER_ID, { name: "Продукты" });

      expect(queryBusMock.execute).toHaveBeenCalledOnce();
      const args = prismaMock.client.category.create.mock.calls[0]?.[0];
      expect(args.data.userId).toBe(USER_ID);
      expect(args.data.icon).toBeNull();
    });

    it("бросает 401, если пользователь не найден, и не пишет в БД", async () => {
      queryBusMock.execute.mockResolvedValue(null);

      await expect(service.create(USER_ID, { name: "Продукты" })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaMock.client.category.create).not.toHaveBeenCalled();
    });

    it("не передаёт color, если его нет в DTO (сработает дефолт БД)", async () => {
      queryBusMock.execute.mockResolvedValue({ id: USER_ID });
      prismaMock.client.category.create.mockResolvedValue(categoryRow);

      await service.create(USER_ID, { name: "Продукты" });

      const args = prismaMock.client.category.create.mock.calls[0]?.[0];
      expect(args.data).not.toHaveProperty("color");
    });

    it("превращает конфликт уникальности P2002 в 409", async () => {
      queryBusMock.execute.mockResolvedValue({ id: USER_ID });
      prismaMock.client.category.create.mockRejectedValue(uniqueError);

      await expect(service.create(USER_ID, { name: "Продукты" })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("update", () => {
    it("не трогает поля, которых нет в DTO", async () => {
      prismaMock.client.category.findFirst.mockResolvedValue(categoryRow);
      prismaMock.client.category.update.mockResolvedValue(categoryRow);

      await service.update(USER_ID, CATEGORY_ID, { name: "Еда" });

      const args = prismaMock.client.category.update.mock.calls[0]?.[0];
      expect(args.data).toEqual({ name: "Еда" });
    });

    it("бросает 404 до попытки записи", async () => {
      prismaMock.client.category.findFirst.mockResolvedValue(null);

      await expect(service.update(USER_ID, CATEGORY_ID, { name: "X" })).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.client.category.update).not.toHaveBeenCalled();
    });

    it("превращает конфликт уникальности P2002 в 409", async () => {
      prismaMock.client.category.findFirst.mockResolvedValue(categoryRow);
      prismaMock.client.category.update.mockRejectedValue(uniqueError);

      await expect(service.update(USER_ID, CATEGORY_ID, { name: "Еда" })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("remove", () => {
    it("удаляет существующую категорию", async () => {
      prismaMock.client.category.findFirst.mockResolvedValue(categoryRow);
      prismaMock.client.category.delete.mockResolvedValue(categoryRow);

      await service.remove(USER_ID, CATEGORY_ID);

      expect(prismaMock.client.category.delete).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
      });
    });

    it("не удаляет чужую категорию", async () => {
      prismaMock.client.category.findFirst.mockResolvedValue(null);

      await expect(service.remove(USER_ID, CATEGORY_ID)).rejects.toThrow(NotFoundException);
      expect(prismaMock.client.category.delete).not.toHaveBeenCalled();
    });
  });
});
