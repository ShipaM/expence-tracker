import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Payments (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  let categoryId: string;

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

  beforeEach(async () => {
    await prisma.client.payment.deleteMany();
    await prisma.client.transaction.deleteMany();
    await prisma.client.category.deleteMany();
    await prisma.client.user.deleteMany();

    const owner = await registerUser("e2e@example.com", "E2E");
    const other = await registerUser("other@example.com", "Чужой");

    token = owner.body.accessToken;
    otherToken = other.body.accessToken;

    const category = await request(app.getHttpServer())
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Подписки" })
      .expect(201);

    categoryId = category.body.id;
  });

  const validBody = () => ({
    name: "Подписка на музыку",
    amount: "299.00",
    type: "EXPENSE",
    period: "MONTHLY",
    nextDueDate: "2026-09-01T00:00:00.000Z",
    categoryId,
  });

  const createPayment = (body: Record<string, unknown> = validBody()) =>
    request(app.getHttpServer())
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  describe("guard", () => {
    it("отклоняет запрос без токена с 401", async () => {
      await request(app.getHttpServer()).get("/api/payments").expect(401);
    });
  });

  describe("POST /api/payments", () => {
    it("создаёт платёж и отдаёт сумму строкой", async () => {
      const response = await createPayment().expect(201);

      expect(response.body).toMatchObject({
        name: "Подписка на музыку",
        amount: "299.00",
        type: "EXPENSE",
        period: "MONTHLY",
        isActive: true,
      });
      expect(response.body.category.name).toBe("Подписки");
    });

    it("отклоняет сумму не того формата с 400", async () => {
      await createPayment({ ...validBody(), amount: "299.999" }).expect(400);
    });

    it("отклоняет неизвестную периодичность с 400", async () => {
      await createPayment({ ...validBody(), period: "DAILY" }).expect(400);
    });

    it("отклоняет чужую категорию с 404", async () => {
      const foreign = await request(app.getHttpServer())
        .post("/api/categories")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Чужая" })
        .expect(201);

      await createPayment({ ...validBody(), categoryId: foreign.body.id }).expect(404);
    });
  });

  describe("GET /api/payments", () => {
    it("возвращает только платежи владельца", async () => {
      await createPayment().expect(201);

      const mine = await request(app.getHttpServer())
        .get("/api/payments")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      const foreign = await request(app.getHttpServer())
        .get("/api/payments")
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(200);

      expect(mine.body).toHaveLength(1);
      expect(foreign.body).toHaveLength(0);
    });

    it("фильтрует по isActive", async () => {
      await createPayment().expect(201);
      await createPayment({ ...validBody(), name: "Выключенный", isActive: false }).expect(201);

      const active = await request(app.getHttpServer())
        .get("/api/payments?isActive=true")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(active.body).toHaveLength(1);
      expect(active.body[0].name).toBe("Подписка на музыку");
    });
  });

  describe("GET /api/payments/:id", () => {
    it("отдаёт 404 на чужой платёж — он неотличим от несуществующего", async () => {
      const created = await createPayment().expect(201);

      await request(app.getHttpServer())
        .get(`/api/payments/${created.body.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);
    });

    it("отдаёт 400 на не-UUID", async () => {
      await request(app.getHttpServer())
        .get("/api/payments/not-a-uuid")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);
    });
  });

  describe("GET /api/payments/upcoming", () => {
    it("не перехватывается маршрутом /:id и считает итоги", async () => {
      // Дата в прошлом: просроченный платёж обязан попасть в окно.
      await createPayment({ ...validBody(), nextDueDate: "2020-01-01T00:00:00.000Z" }).expect(201);
      await createPayment({
        ...validBody(),
        name: "Зарплата",
        type: "INCOME",
        amount: "75000.00",
        nextDueDate: "2020-01-05T00:00:00.000Z",
      }).expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/payments/upcoming?days=30")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.totalExpense).toBe("299.00");
      expect(response.body.totalIncome).toBe("75000.00");
    });

    it("не берёт выключенные платежи", async () => {
      await createPayment({
        ...validBody(),
        nextDueDate: "2020-01-01T00:00:00.000Z",
        isActive: false,
      }).expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/payments/upcoming")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body.items).toHaveLength(0);
      expect(response.body.totalExpense).toBe("0.00");
    });

    it("отклоняет days вне диапазона с 400", async () => {
      await request(app.getHttpServer())
        .get("/api/payments/upcoming?days=400")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);
    });
  });

  describe("POST /api/payments/:id/pay", () => {
    it("создаёт транзакцию, сдвигает дату и попадает в список транзакций", async () => {
      const created = await createPayment().expect(201);

      const paid = await request(app.getHttpServer())
        .post(`/api/payments/${created.body.id}/pay`)
        .set("Authorization", `Bearer ${token}`)
        .expect(201);

      expect(paid.body.transaction.amount).toBe("299.00");
      // Дата транзакции — плановая дата платежа, а не «сейчас».
      expect(paid.body.transaction.date).toBe("2026-09-01T00:00:00.000Z");
      expect(paid.body.payment.nextDueDate).toBe("2026-10-01T00:00:00.000Z");

      const transactions = await request(app.getHttpServer())
        .get("/api/transactions")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(transactions.body.total).toBe(1);
      expect(transactions.body.items[0].description).toBe("Подписка на музыку");
    });

    it("отдаёт 404 на чужой платёж и не создаёт транзакцию", async () => {
      const created = await createPayment().expect(201);

      await request(app.getHttpServer())
        .post(`/api/payments/${created.body.id}/pay`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);

      const transactions = await request(app.getHttpServer())
        .get("/api/transactions")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(transactions.body.total).toBe(0);
    });
  });

  describe("PATCH /api/payments/:id", () => {
    it("меняет только переданные поля", async () => {
      const created = await createPayment().expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/api/payments/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: "349.00" })
        .expect(200);

      expect(updated.body.amount).toBe("349.00");
      expect(updated.body.name).toBe("Подписка на музыку");
    });

    it("отдаёт 404 на чужой платёж", async () => {
      const created = await createPayment().expect(201);

      await request(app.getHttpServer())
        .patch(`/api/payments/${created.body.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ amount: "1.00" })
        .expect(404);
    });
  });

  describe("DELETE /api/payments/:id", () => {
    it("удаляет платёж, но оставляет созданные из него транзакции", async () => {
      const created = await createPayment().expect(201);
      await request(app.getHttpServer())
        .post(`/api/payments/${created.body.id}/pay`)
        .set("Authorization", `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/payments/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      const transactions = await request(app.getHttpServer())
        .get("/api/transactions")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(transactions.body.total).toBe(1);
    });

    it("отдаёт 404 на чужой платёж", async () => {
      const created = await createPayment().expect(201);

      await request(app.getHttpServer())
        .delete(`/api/payments/${created.body.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);
    });
  });
});
