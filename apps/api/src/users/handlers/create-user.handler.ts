import { ConflictException } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import type { User } from "@repo/db";
import { CreateUserCommand } from "../contracts/create-user.command";
import { UsersService } from "../users.service";

// P2002 — нарушение уникальности (email); ловим утиной проверкой, чтобы не
// завязываться на путь импорта класса ошибки Prisma.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand, User> {
  constructor(private readonly users: UsersService) {}

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
