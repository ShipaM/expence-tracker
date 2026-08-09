/**
 * CQRS-запрос «дай пользователя по id» — часть публичной поверхности модуля Users.
 *
 * Диспетчится через `QueryBus`; `TransactionsService` шлёт его перед созданием записи,
 * чтобы не импортировать `UsersService`. Обрабатывает `GetUserByIdHandler`,
 * результат — `User | null`.
 */
export class GetUserByIdQuery {
  /** @param id Идентификатор искомого пользователя (UUID). */
  constructor(public readonly id: string) {}
}
