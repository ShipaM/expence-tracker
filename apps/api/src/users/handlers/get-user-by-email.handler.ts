import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { User } from "@repo/db";
import { GetUserByEmailQuery } from "../contracts/get-user-by-email.query";
import { UsersService } from "../users.service";

/**
 * Обработчик {@link GetUserByEmailQuery}: отдаёт пользователя по email внешним модулям,
 * не раскрывая им `UsersService`.
 */
@QueryHandler(GetUserByEmailQuery)
export class GetUserByEmailHandler implements IQueryHandler<GetUserByEmailQuery, User | null> {
  /** @param users Сервис пользователей, приватный для модуля Users. */
  constructor(private readonly users: UsersService) {}

  /**
   * Ищет пользователя по email из запроса.
   *
   * @param query Запрос с email.
   * @returns Запись пользователя или `null`, если такого нет (отсутствие — не ошибка:
   *   решение принимает вызывающий, `AuthService.login` отвечает на это 401).
   */
  execute(query: GetUserByEmailQuery): Promise<User | null> {
    return this.users.findByEmail(query.email);
  }
}
