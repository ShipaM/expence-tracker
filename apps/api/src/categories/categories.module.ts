import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { AuthModule } from "../auth/auth.module";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

/**
 * Модуль категорий: контроллер `/api/categories` и его сервис.
 *
 * `AuthModule` даёт `JwtAuthGuard`, `CqrsModule` — `QueryBus` (через него диспетчится
 * `GetUserByIdQuery`). `UsersModule` намеренно не импортируется, `PrismaService` приходит
 * из глобального `PrismaModule`.
 */
@Module({
  imports: [AuthModule, CqrsModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
