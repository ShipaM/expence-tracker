import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AuthModule } from "../auth/auth.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

/**
 * Модуль регулярных платежей: контроллер `/api/payments` и его сервис.
 *
 * `AuthModule` даёт `JwtAuthGuard`, `CqrsModule` — `QueryBus` (через него диспетчится
 * `GetUserByIdQuery`). `UsersModule` намеренно не импортируется: хэндлеры Users `CqrsModule`
 * регистрирует глобально. `PrismaService` приходит из глобального `PrismaModule`.
 *
 * `TransactionsModule` тоже не импортируется: при отметке об оплате транзакция создаётся
 * напрямую через Prisma в одной БД-транзакции с обновлением платежа — вызов чужого сервиса
 * разорвал бы атомарность.
 */
@Module({
  imports: [AuthModule, CqrsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
