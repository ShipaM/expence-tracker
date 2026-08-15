import { Injectable } from "@nestjs/common";
import type { User } from "@repo/db";
import { PrismaService } from "../prisma/prisma.service";

/** Данные для создания пользователя: пароль приходит уже захэшированным. */
export interface CreateUserData {
  /** Email пользователя; в БД на нём уникальный индекс. */
  email: string;
  /** Отображаемое имя. */
  name: string;
  /** Готовый bcrypt-хэш: считает `AuthService`, этот слой пароли не обрабатывает. */
  passwordHash: string;
}

/**
 * Запросы к таблице `user` — единственное место, где модуль Users ходит в БД.
 *
 * Приватен для модуля (в `exports` `UsersModule` его нет): снаружи доступ идёт через
 * CQRS-хэндлеры, а внутри модуля — через {@link UsersService}. Методы отдают запись `User`
 * целиком, **вместе с `passwordHash`**, поэтому результат нельзя возвращать из контроллера
 * как есть — наружу собирается `UserDto` в `AuthService.toUserDto`.
 */
@Injectable()
export class UsersRepository {
  /** @param prisma Доступ к Prisma-клиенту (`prisma.client`). */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Вставляет нового пользователя.
   *
   * Проверки занятости email здесь нет: уникальность обеспечивает индекс в БД, а ошибку
   * ловит `CreateUserHandler` и превращает в `ConflictException` — так между проверкой и
   * вставкой не остаётся гонки.
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
   * Используется входом: `AuthService.login` сверяет пароль с `passwordHash` найденной записи,
   * поэтому хэш из выборки не исключается.
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
   * Через `GetUserByIdQuery` этим проверяют, что владелец токена ещё существует: JWT живёт
   * 7 дней и переживает удаление аккаунта, поэтому `null` здесь означает `UnauthorizedException`
   * у вызывающего модуля, а не «запись просто не нашлась».
   *
   * @param id Идентификатор пользователя (UUID).
   * @returns Запись пользователя или `null`, если такого нет.
   */
  findById(id: string): Promise<User | null> {
    return this.prisma.client.user.findUnique({ where: { id } });
  }
}
