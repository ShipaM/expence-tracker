/**
 * CQRS-команда «создай пользователя» — часть публичной поверхности модуля Users.
 *
 * Диспетчится через `CommandBus` из `AuthService`. Пароль сюда приходит **уже захэшированным**:
 * bcrypt живёт в Auth, Users лишь сохраняет готовый хэш. Обрабатывает `CreateUserHandler`,
 * результат — созданный `User`.
 */
export class CreateUserCommand {
  /**
   * @param email Email пользователя; уникален в БД.
   * @param name Отображаемое имя.
   * @param passwordHash Готовый bcrypt-хэш, не сырой пароль.
   */
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly passwordHash: string,
  ) {}
}
