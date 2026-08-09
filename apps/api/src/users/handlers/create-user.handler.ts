import { ConflictException } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import type { User } from "@repo/db";
import { CreateUserCommand } from "../contracts/create-user.command";
import { UsersService } from "../users.service";

/**
 * Отличает нарушение уникальности от прочих ошибок Prisma.
 *
 * P2002 — нарушение уникальности (email); ловим утиной проверкой, чтобы не завязываться
 * на путь импорта класса ошибки Prisma.
 *
 * @param error Пойманное исключение, тип неизвестен.
 * @returns `true`, если это ошибка Prisma с кодом `P2002`.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/**
 * Обработчик {@link CreateUserCommand}: сохраняет пользователя и переводит конфликт
 * уникальности email в понятный HTTP-ответ.
 */
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand, User> {
  /** @param users Сервис пользователей, приватный для модуля Users. */
  constructor(private readonly users: UsersService) {}

  /**
   * Создаёт пользователя с готовым хэшем пароля.
   *
   * @param command Команда с email, именем и `passwordHash`.
   * @returns Созданная запись пользователя.
   * @throws {ConflictException} Email уже занят (Prisma `P2002`).
   * @throws {unknown} Прочие ошибки Prisma пробрасываются как есть.
   */
  async execute(command: CreateUserCommand): Promise<User> {
    try {
      return await this.users.create({
        email: command.email,
        name: command.name,
        passwordHash: command.passwordHash,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Email уже занят");
      }
      throw error;
    }
  }
}
