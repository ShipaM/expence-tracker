import { Injectable } from "@nestjs/common";
import type { User } from "@repo/db";
import { PrismaService } from "../prisma/prisma.service";

/** Данные для создания пользователя: пароль приходит уже захэшированным. */
export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
}

/** Запросы к таблице `user` — единственное место, где модуль Users ходит в БД. */
@Injectable()
export class UsersRepository {
  /** @param prisma Доступ к Prisma-клиенту (`prisma.client`). */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Вставляет нового пользователя.
   *
   * @param data Email, имя и готовый хэш пароля.
   * @returns Созданная запись пользователя.
   * @throws {PrismaClientKnownRequestError} Код `P2002` — нарушен уникальный индекс по email.
   */
  create(data: CreateUserData): Promise<User> {
    return this.prisma.client.user.create({ data });
  }

  /**
   * Ищет пользователя по уникальному email.
   *
   * @param email Email пользователя.
   * @returns Запись пользователя или `null`, если такого нет.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.client.user.findUnique({ where: { email } });
  }

  /**
   * Ищет пользователя по первичному ключу.
   *
   * @param id Идентификатор пользователя (UUID).
   * @returns Запись пользователя или `null`, если такого нет.
   */
  findById(id: string): Promise<User | null> {
    return this.prisma.client.user.findUnique({ where: { id } });
  }
}
