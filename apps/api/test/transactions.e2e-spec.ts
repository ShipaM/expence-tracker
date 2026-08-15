import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Transactions (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  let categoryId: string;
  let otherCategoryId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // Повторяем конфигурацию из main.ts, иначе e2e тестирует не то приложение, что в проде.
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const registerUser = (email: string, name: string) =>
    request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, name, password: "secret12" })
      .expect(201);

  const createCategory = (authToken: string, name: string) =>
    request(app.getHttpServer())
      .post("/api/categories")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name })
      .expect(201);

  beforeEach(async () => {
    await prisma.client.transaction.deleteMany();
    await prisma.client.category.deleteMany();
    await prisma.client.user.deleteMany();

    const owner = await registerUser("e2e@example.com", "E2E");
    const other = await registerUser("other@example.com", "Чужой");
    token = owner.body.accessToken;
    otherToken = other.body.accessToken;

    categoryId = (await createCategory(token, "Продукты")).body.id;
    otherCategoryId = (await createCategory(otherToken, "Чужая")).body.id;
  });

  const createTransaction = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    amount: "1234.56",
    type: "EXPENSE",
    date: "2026-07-14T10:00:00.000Z",
    categoryId,
    ...overrides,
  });

  describe("guard", () => {
    it("отклоняет запрос без токена с 401", async () => {
      await request(app.getHttpServer()).get("/api/transactions").expect(401);
    });
  });

  describe("POST /api/transactions", () => {
    it("создаёт транзакцию и возвращает DTO с вложенной категорией", async () => {
      const response = await createTransaction(validBody({ description: "Пятёрочка" })).expect(201);

      expect(response.body).toMatchObject({
        amount: "1234.56",
        type: "EXPENSE",
        description: "Пятёрочка",
        date: "2026-07-14T10:00:00.000Z",
      });
      expect(response.body.id).toEqual(expect.any(String));
      expect(response.body.category).toMatchObject({ id: categoryId, name: "Продукты" });
    });

    it("отклоняет некорректную сумму с 400", async () => {
      await createTransaction(validBody({ amount: "10.999" })).expect(400);
    });

    it("отклоняет неизвестный type с 400", async () => {
      await createTransaction(validBody({ type: "TRANSFER" })).expect(400);
    });

    it("отклоняет лишние поля с 400 (whitelist)", async () => {
      await createTransaction(validBody({ userId: "хак" })).expect(400);
    });

    it("возвращает 404 при создании с чужой категорией", async () => {
      await createTransaction(validBody({ categoryId: otherCategoryId })).expect(404);
    });
  });

  describe("GET /api/transactions", () => {
    it("фильтрует по type и categoryId", async () => {
      await createTransaction(validBody({ type: "EXPENSE" })).expect(201);
      await createTransaction(validBody({ type: "INCOME", amount: "5000.00" })).expect(201);

      const income = await request(app.getHttpServer())
        .get("/api/transactions?type=INCOME")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(income.body.items).toHaveLength(1);
      expect(income.body.items[0].type).toBe("INCOME");

      const byCategory = await request(app.getHttpServer())
        .get(`/api/transactions?categoryId=${categoryId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(byCategory.body.items).toHaveLength(2);
    });

    it("фильтрует по диапазону дат", async () => {
      await createTransaction(validBody({ date: "2026-07-05T00:00:00.000Z" })).expect(201);
      await createTransaction(validBody({ date: "2026-08-05T00:00:00.000Z" })).expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/transactions?dateFrom=2026-07-01T00:00:00.000Z&dateTo=2026-07-31T23:59:59.000Z")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(response.body.items).toHaveLength(1);
    });

    it("не показывает транзакции чужого пользователя", async () => {
      await createTransaction(validBody()).expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/transactions")
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(200);
      expect(response.body).toMatchObject({ items: [], total: 0 });
    });

    it("пагинирует: total по фильтру, items — только запрошенная страница", async () => {
      // 3 транзакции с разными датами → порядок date desc детерминирован.
      await createTransaction(validBody({ date: "2026-07-01T00:00:00.000Z" })).expect(201);
      await createTransaction(validBody({ date: "2026-07-02T00:00:00.000Z" })).expect(201);
      await createTransaction(validBody({ date: "2026-07-03T00:00:00.000Z" })).expect(201);

      const page1 = await request(app.getHttpServer())
        .get("/api/transactions?page=1&limit=2")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(page1.body).toMatchObject({ total: 3, page: 1, limit: 2 });
      expect(page1.body.items).toHaveLength(2);
      // date desc: самая свежая (03) — первой.
      expect(page1.body.items[0].date).toBe("2026-07-03T00:00:00.000Z");

      const page2 = await request(app.getHttpServer())
        .get("/api/transactions?page=2&limit=2")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(page2.body).toMatchObject({ total: 3, page: 2, limit: 2 });
      expect(page2.body.items).toHaveLength(1);
      expect(page2.body.items[0].date).toBe("2026-07-01T00:00:00.000Z");
    });
  });

  describe("GET /api/transactions/summary", () => {
    it("агрегирует итоги и разбивку по категориям за месяц", async () => {
      await createTransaction(validBody({ type: "INCOME", amount: "5000.00" })).expect(201);
      await createTransaction(validBody({ type: "EXPENSE", amount: "3200.00" })).expect(201);
      // Другой месяц — не должен попасть в июльский summary.
      await createTransaction(
        validBody({ amount: "999.00", date: "2026-08-01T00:00:00.000Z" }),
      ).expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/transactions/summary?month=7&year=2026")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        income: "5000.00",
        expense: "3200.00",
        balance: "1800.00",
      });
      expect(response.body.byCategory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            categoryId,
            name: "Продукты",
            type: "INCOME",
            total: "5000.00",
          }),
          expect.objectContaining({
            categoryId,
            name: "Продукты",
            type: "EXPENSE",
            total: "3200.00",
          }),
        ]),
      );
    });

    it("возвращает 400 без обязательных month/year", async () => {
      await request(app.getHttpServer())
        .get("/api/transactions/summary")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      await request(app.getHttpServer())
        .get("/api/transactions/summary?month=7")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);
    });

    it("не даёт '/summary' попасть в маршрут /:id (не 404 по UUID)", async () => {
      await request(app.getHttpServer())
        .get("/api/transactions/summary?month=7&year=2026")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    });
  });

  describe("GET /api/transactions/:id", () => {
    it("возвращает 404 на чужую транзакцию", async () => {
      const created = await createTransaction(validBody()).expect(201);

      await request(app.getHttpServer())
        .get(`/api/transactions/${created.body.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);
    });
  });

  describe("PATCH /api/transactions/:id", () => {
    it("обновляет только переданные поля", async () => {
      const created = await createTransaction(validBody({ amount: "100.00" })).expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/transactions/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: "250.50" })
        .expect(200);

      expect(response.body.amount).toBe("250.50");
      expect(response.body.type).toBe("EXPENSE");
    });

    it("возвращает 404 на чужую транзакцию", async () => {
      const created = await createTransaction(validBody()).expect(201);

      await request(app.getHttpServer())
        .patch(`/api/transactions/${created.body.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ amount: "1.00" })
        .expect(404);
    });
  });

  describe("DELETE /api/transactions/:id", () => {
    it("удаляет транзакцию и возвращает 204", async () => {
      const created = await createTransaction(validBody()).expect(201);

      await request(app.getHttpServer())
        .delete(`/api/transactions/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      const list = await request(app.getHttpServer())
        .get("/api/transactions")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(list.body).toMatchObject({ items: [], total: 0 });
    });

    it("не даёт удалить чужую транзакцию", async () => {
      const created = await createTransaction(validBody()).expect(201);

      await request(app.getHttpServer())
        .delete(`/api/transactions/${created.body.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);
    });
  });
});
