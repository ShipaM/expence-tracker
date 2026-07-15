import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Expenses (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let otherUserId: string;
  let categoryId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // Повторяем конфигурацию из main.ts, иначе e2e тестирует не то приложение, что в проде.
    app.setGlobalPrefix("api");
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.client.expense.deleteMany();
    await prisma.client.category.deleteMany();
    await prisma.client.user.deleteMany();

    const user = await prisma.client.user.create({
      data: { email: "e2e@example.com", name: "E2E" },
    });
    const other = await prisma.client.user.create({
      data: { email: "other@example.com", name: "Чужой" },
    });
    const category = await prisma.client.category.create({
      data: { name: "Продукты", color: "#22c55e", userId: user.id },
    });

    userId = user.id;
    otherUserId = other.id;
    categoryId = category.id;
  });

  const createExpense = () =>
    request(app.getHttpServer())
      .post(`/api/expenses?userId=${userId}`)
      .send({
        title: "Пятёрочка",
        amount: "1234.56",
        type: "EXPENSE",
        spentAt: "2026-07-14T10:00:00.000Z",
        categoryId,
      });

  describe("POST /api/expenses", () => {
    // Регрессия: с @UsePipes на методе пайп применялся и к userId из query,
    // и валидный запрос падал с «expected object, received string».
    it("создаёт расход и возвращает DTO", async () => {
      const response = await createExpense().expect(201);

      expect(response.body).toMatchObject({
        title: "Пятёрочка",
        amount: "1234.56",
        type: "EXPENSE",
        category: { id: categoryId, name: "Продукты" },
      });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it("отдаёт сумму строкой, не числом", async () => {
      const response = await createExpense().expect(201);

      expect(typeof response.body.amount).toBe("string");
    });

    it("отклоняет сумму с тремя знаками после запятой", async () => {
      await request(app.getHttpServer())
        .post(`/api/expenses?userId=${userId}`)
        .send({ title: "Плохой", amount: "10.999", spentAt: "2026-07-14T10:00:00.000Z" })
        .expect(400);
    });

    it("отклоняет запрос без обязательных полей", async () => {
      await request(app.getHttpServer())
        .post(`/api/expenses?userId=${userId}`)
        .send({ title: "Без суммы" })
        .expect(400);
    });

    it("отклоняет userId, который не UUID", async () => {
      await request(app.getHttpServer())
        .post("/api/expenses?userId=not-a-uuid")
        .send({ title: "X", amount: "10.00", spentAt: "2026-07-14T10:00:00.000Z" })
        .expect(400);
    });
  });

  describe("GET /api/expenses", () => {
    it("отдаёт пустой список для нового пользователя", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/expenses?userId=${userId}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("не показывает расходы чужого пользователя", async () => {
      await createExpense().expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/expenses?userId=${otherUserId}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe("PATCH /api/expenses/:id", () => {
    it("обновляет только переданные поля", async () => {
      const created = await createExpense().expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/expenses/${created.body.id}?userId=${userId}`)
        .send({ title: "Магнит" })
        .expect(200);

      expect(response.body.title).toBe("Магнит");
      expect(response.body.amount).toBe("1234.56");
    });

    it("возвращает 404 на чужой расход", async () => {
      const created = await createExpense().expect(201);

      await request(app.getHttpServer())
        .patch(`/api/expenses/${created.body.id}?userId=${otherUserId}`)
        .send({ title: "Взлом" })
        .expect(404);
    });
  });

  describe("DELETE /api/expenses/:id", () => {
    it("удаляет расход и возвращает 204", async () => {
      const created = await createExpense().expect(201);

      await request(app.getHttpServer())
        .delete(`/api/expenses/${created.body.id}?userId=${userId}`)
        .expect(204);

      const list = await request(app.getHttpServer())
        .get(`/api/expenses?userId=${userId}`)
        .expect(200);
      expect(list.body).toEqual([]);
    });

    it("возвращает 404 при повторном удалении", async () => {
      const created = await createExpense().expect(201);

      await request(app.getHttpServer())
        .delete(`/api/expenses/${created.body.id}?userId=${userId}`)
        .expect(204);
      await request(app.getHttpServer())
        .delete(`/api/expenses/${created.body.id}?userId=${userId}`)
        .expect(404);
    });

    it("не даёт удалить чужой расход", async () => {
      const created = await createExpense().expect(201);

      await request(app.getHttpServer())
        .delete(`/api/expenses/${created.body.id}?userId=${otherUserId}`)
        .expect(404);

      const list = await request(app.getHttpServer())
        .get(`/api/expenses?userId=${userId}`)
        .expect(200);
      expect(list.body).toHaveLength(1);
    });
  });
});
