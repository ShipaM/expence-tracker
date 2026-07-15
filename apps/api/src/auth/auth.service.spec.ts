import { UnauthorizedException } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateUserCommand } from "../users/contracts/create-user.command";
import { GetUserByEmailQuery } from "../users/contracts/get-user-by-email.query";
import { GetUserByIdQuery } from "../users/contracts/get-user-by-id.query";
import { AuthService } from "./auth.service";

const USER_ID = "b292ff2b-db0a-44bf-aa4a-b4e6fc353283";

const makeUser = (passwordHash: string) => ({
  id: USER_ID,
  email: "user@example.com",
  name: "Тест",
  passwordHash,
  createdAt: new Date("2026-07-15T10:00:00.000Z"),
  updatedAt: new Date("2026-07-15T10:00:00.000Z"),
});

const commandBus = { execute: vi.fn() };
const queryBus = { execute: vi.fn() };
const jwt = { sign: vi.fn(() => "signed.jwt.token") };

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe("register", () => {
    it("хэширует пароль и диспатчит CreateUserCommand", async () => {
      commandBus.execute.mockResolvedValue(makeUser("hash"));

      const result = await service.register({
        email: "user@example.com",
        name: "Тест",
        password: "secret12",
      });

      const command = commandBus.execute.mock.calls[0]?.[0] as CreateUserCommand;
      expect(command).toBeInstanceOf(CreateUserCommand);
      expect(command.email).toBe("user@example.com");
      expect(command.name).toBe("Тест");
      // Наружу уходит именно хэш, а не сырой пароль, и он проверяется bcrypt'ом.
      expect(command.passwordHash).not.toBe("secret12");
      expect(await bcrypt.compare("secret12", command.passwordHash)).toBe(true);
      expect(result.accessToken).toBe("signed.jwt.token");
    });

    it("не отдаёт хэш пароля в ответе", async () => {
      commandBus.execute.mockResolvedValue(makeUser("supersecrethash"));

      const result = await service.register({
        email: "user@example.com",
        name: "Тест",
        password: "secret12",
      });

      expect(result.user).toEqual({ id: USER_ID, email: "user@example.com", name: "Тест" });
      expect(JSON.stringify(result)).not.toContain("supersecrethash");
    });
  });

  describe("login", () => {
    it("возвращает токен при верном пароле", async () => {
      const hash = await bcrypt.hash("secret12", 10);
      queryBus.execute.mockResolvedValue(makeUser(hash));

      const result = await service.login({ email: "user@example.com", password: "secret12" });

      expect(queryBus.execute.mock.calls[0]?.[0]).toBeInstanceOf(GetUserByEmailQuery);
      expect(result.accessToken).toBe("signed.jwt.token");
      expect(result.user.id).toBe(USER_ID);
    });

    it("бросает Unauthorized при неверном пароле", async () => {
      const hash = await bcrypt.hash("secret12", 10);
      queryBus.execute.mockResolvedValue(makeUser(hash));

      await expect(service.login({ email: "user@example.com", password: "wrong" })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("бросает Unauthorized, если пользователя нет", async () => {
      queryBus.execute.mockResolvedValue(null);

      await expect(
        service.login({ email: "nobody@example.com", password: "secret12" }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("me", () => {
    it("отдаёт профиль без хэша", async () => {
      queryBus.execute.mockResolvedValue(makeUser("hash"));

      const result = await service.me(USER_ID);

      expect(queryBus.execute.mock.calls[0]?.[0]).toBeInstanceOf(GetUserByIdQuery);
      expect(result).toEqual({ id: USER_ID, email: "user@example.com", name: "Тест" });
    });

    it("бросает Unauthorized, если пользователь не найден", async () => {
      queryBus.execute.mockResolvedValue(null);

      await expect(service.me(USER_ID)).rejects.toThrow(UnauthorizedException);
    });
  });
});
