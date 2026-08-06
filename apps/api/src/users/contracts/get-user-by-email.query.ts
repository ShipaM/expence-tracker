/**
 * CQRS-запрос «дай пользователя по email» — часть публичной поверхности модуля Users.
 *
 * Диспетчится через `QueryBus` из `AuthService` при входе. Обрабатывает
 * `GetUserByEmailHandler`, результат — `User | null` (вместе с `passwordHash`, который нужен
 * Auth для сверки пароля).
 */
export class GetUserByEmailQuery {
  /** @param email Email искомого пользователя. */
  constructor(public readonly email: string) {}
}
