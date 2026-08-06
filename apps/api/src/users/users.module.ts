import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { CreateUserHandler } from "./handlers/create-user.handler";
import { GetUserByEmailHandler } from "./handlers/get-user-by-email.handler";
import { GetUserByIdHandler } from "./handlers/get-user-by-id.handler";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

/** CQRS-хэндлеры модуля; `CqrsModule` регистрирует их глобально. */
const handlers = [CreateUserHandler, GetUserByEmailHandler, GetUserByIdHandler];

/**
 * Модуль пользователей: хранение и выдача записей. Контроллера нет — HTTP-поверхности у Users
 * не существует.
 *
 * Наружу торчат только классы-контракты из `./contracts` — сервис и репозиторий приватны для
 * модуля (в `exports` их нет), остальные модули обращаются к ним через `CommandBus`/`QueryBus`.
 * Поэтому импортировать `UsersModule` откуда-либо не нужно.
 */
@Module({
  imports: [CqrsModule],
  providers: [UsersRepository, UsersService, ...handlers],
})
export class UsersModule {}
