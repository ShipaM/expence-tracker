import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { User } from "@repo/db";
import { GetUserByIdQuery } from "../contracts/get-user-by-id.query";
import { UsersService } from "../users.service";

/**
 * Обработчик {@link GetUserByIdQuery}: единственный способ для внешних модулей получить
 * пользователя по id, не импортируя `UsersModule` (`CqrsModule` регистрирует хэндлеры глобально).
 */
@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, User | null> {
  /** @param users Сервис пользователей, приватный для модуля Users. */
  constructor(private readonly users: UsersService) {}

  /**
   * Ищет пользователя по идентификатору из запроса.
   *
   * @param query Запрос с идентификатором пользователя.
   * @returns Запись пользователя или `null`, если такого нет (отсутствие — не ошибка,
   *   решение принимает вызывающий сервис).
   */
  execute(query: GetUserByIdQuery): Promise<User | null> {
    return this.users.findById(query.id);
  }
}
