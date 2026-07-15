import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const credentials = { email: "auth@example.com", name: "Тест", password: "secret12" };

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
  });

  const register = () => request(app.getHttpServer()).post("/api/auth/register").send(credentials);

  describe("POST /api/auth/register", () => {
    it("создаёт пользователя и возвращает токен без хэша", async () => {
      const response = await register().expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({
        email: credentials.email,
        name: credentials.name,
      });
      expect(response.body.user.id).toEqual(expect.any(String));
      expect(response.body.user).not.toHaveProperty("passwordHash");
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    });

    it("отклоняет дубликат email с 409", async () => {
      await register().expect(201);
      await register().expect(409);
    });

    it("отклоняет короткий пароль с 400", async () => {
      await request(app.getHttpServer())
        .post("/api/auth/register")
        .send({ email: "short@example.com", name: "X", password: "123" })
        .expect(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("логинит и возвращает токен", async () => {
      await register().expect(201);

      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: credentials.email, password: credentials.password })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.user.email).toBe(credentials.email);
    });

    it("отклоняет неверный пароль с 401", async () => {
      await register().expect(201);

      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: credentials.email, password: "wrong-password" })
        .expect(401);
    });

    it("отклоняет несуществующего пользователя с 401", async () => {
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "secret12" })
        .expect(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("возвращает профиль по токену", async () => {
      const { body } = await register().expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${body.accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ email: credentials.email, name: credentials.name });
      expect(response.body).not.toHaveProperty("passwordHash");
    });

    it("отклоняет запрос без токена с 401", async () => {
      await request(app.getHttpServer()).get("/api/auth/me").expect(401);
    });

    it("отклоняет мусорный токен с 401", async () => {
      await request(app.getHttpServer())
        .get("/api/auth/me")
        .set("Authorization", "Bearer garbage.token.value")
        .expect(401);
    });
  });
});
