import { Injectable } from "@nestjs/common";
import type { User } from "@repo/db";
import { CreateUserData, UsersRepository } from "./users.repository";

/**
 * Тонкий слой над репозиторием: точка для будущих доменных правил.
 *
 * Приватен для модуля Users — снаружи доступен только через CQRS-хэндлеры.
 */
@Injectable()
export class UsersService {
  /** @param users Репозиторий пользователей. */
  constructor(private readonly users: UsersRepository) {}

  /**
   * Создаёт пользователя с уже готовым хэшем пароля.
   *
   * @param data Email, имя и `passwordHash` (хэширует `AuthService`, не этот слой).
   * @returns Созданная запись пользователя.
   * @throws {PrismaClientKnownRequestError} Код `P2002` — email занят; вызывающий
   *   `CreateUserHandler` превращает это в `ConflictException`.
   */
  create(data: CreateUserData): Promise<User> {
    return this.users.create(data);
  }

  /**
   * Ищет пользователя по email.
   *
   * @param email Email (уникальное поле).
   * @returns Запись пользователя или `null`, если такого нет.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  /**
   * Ищет пользователя по идентификатору.
   *
   * @param id Идентификатор пользователя (UUID).
   * @returns Запись пользователя или `null`, если такого нет.
   */
  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }
}
