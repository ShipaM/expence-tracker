import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Categories (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;

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
    await prisma.client.expense.deleteMany();
    await prisma.client.category.deleteMany();
    await prisma.client.user.deleteMany();

    const owner = await registerUser("e2e@example.com", "E2E");
    const other = await registerUser("other@example.com", "Чужой");

    token = owner.body.accessToken;
    otherToken = other.body.accessToken;
  });

  const createCategory = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post("/api/categories")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  describe("guard", () => {
    it("отклоняет запрос без токена с 401", async () => {
      await request(app.getHttpServer()).get("/api/categories").expect(401);
    });
  });

  describe("POST /api/categories", () => {
    it("создаёт категорию и возвращает DTO", async () => {
      const response = await createCategory({
        name: "Продукты",
        color: "#22c55e",
        icon: "cart",
      }).expect(201);

      expect(response.body).toMatchObject({
        name: "Продукты",
        color: "#22c55e",
        icon: "cart",
      });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it("подставляет дефолтный цвет, если он не передан", async () => {
      const response = await createCategory({ name: "Без цвета" }).expect(201);

      expect(response.body.color).toBe("#6366f1");
      expect(response.body.icon).toBeNull();
    });

    it("отклоняет пустое имя с 400", async () => {
      await createCategory({ name: "" }).expect(400);
    });

    it("отклоняет некорректный HEX-цвет с 400", async () => {
      await createCategory({ name: "Плохая", color: "red" }).expect(400);
    });

    it("отклоняет лишние поля с 400 (whitelist)", async () => {
      await createCategory({ name: "Лишнее", userId: "хак" }).expect(400);
    });

    it("возвращает 409 при дублировании имени у одного пользователя", async () => {
      await createCategory({ name: "Дубль" }).expect(201);
      await createCategory({ name: "Дубль" }).expect(409);
    });

    it("разрешает одинаковые имена у разных пользователей", async () => {
      await createCategory({ name: "Общая" }).expect(201);
      await request(app.getHttpServer())
        .post("/api/categories")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Общая" })
        .expect(201);
    });
  });

  describe("GET /api/categories", () => {
    it("отдаёт пустой список для нового пользователя", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/categories")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("не показывает категории чужого пользователя", async () => {
      await createCategory({ name: "Моя" }).expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/categories")
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe("PATCH /api/categories/:id", () => {
    it("обновляет только переданные поля", async () => {
      const created = await createCategory({ name: "Еда", color: "#22c55e" }).expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/categories/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Питание" })
        .expect(200);

      expect(response.body.name).toBe("Питание");
      expect(response.body.color).toBe("#22c55e");
    });

    it("возвращает 404 на чужую категорию", async () => {
      const created = await createCategory({ name: "Секрет" }).expect(201);

      await request(app.getHttpServer())
        .patch(`/api/categories/${created.body.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Взлом" })
        .expect(404);
    });

    it("возвращает 409 при переименовании в существующее имя", async () => {
      await createCategory({ name: "Первая" }).expect(201);
      const second = await createCategory({ name: "Вторая" }).expect(201);

      await request(app.getHttpServer())
        .patch(`/api/categories/${second.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Первая" })
        .expect(409);
    });
  });

  describe("DELETE /api/categories/:id", () => {
    it("удаляет категорию и возвращает 204", async () => {
      const created = await createCategory({ name: "Удалить" }).expect(201);

      await request(app.getHttpServer())
        .delete(`/api/categories/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      const list = await request(app.getHttpServer())
        .get("/api/categories")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(list.body).toEqual([]);
    });

    it("возвращает 404 при повторном удалении", async () => {
      const created = await createCategory({ name: "Раз" }).expect(201);

      await request(app.getHttpServer())
        .delete(`/api/categories/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);
      await request(app.getHttpServer())
        .delete(`/api/categories/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("не даёт удалить чужую категорию", async () => {
      const created = await createCategory({ name: "Чужая" }).expect(201);

      await request(app.getHttpServer())
        .delete(`/api/categories/${created.body.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);

      const list = await request(app.getHttpServer())
        .get("/api/categories")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(list.body).toHaveLength(1);
    });
  });
});
