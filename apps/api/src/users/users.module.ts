import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { CreateUserHandler } from "./handlers/create-user.handler";
import { GetUserByEmailHandler } from "./handlers/get-user-by-email.handler";
import { GetUserByIdHandler } from "./handlers/get-user-by-id.handler";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

const handlers = [CreateUserHandler, GetUserByEmailHandler, GetUserByIdHandler];

// Наружу торчат только классы-контракт из ./contracts — сервис и репозиторий
// приватны для модуля, Auth обращается к ним через CommandBus/QueryBus.
@Module({
  imports: [CqrsModule],
  providers: [UsersRepository, UsersService, ...handlers],
})
export class UsersModule {}
