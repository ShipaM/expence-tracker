import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AuthModule } from "../auth/auth.module";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

/**
 * Модуль транзакций: контроллер `/api/transactions` и его сервис.
 *
 * `AuthModule` даёт `JwtAuthGuard`, `CqrsModule` — `QueryBus` (через него диспетчится
 * `GetUserByIdQuery`). `UsersModule` намеренно не импортируется: хэндлеры Users
 * `CqrsModule` регистрирует глобально. `PrismaService` приходит из глобального `PrismaModule`.
 */
@Module({
  imports: [AuthModule, CqrsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
