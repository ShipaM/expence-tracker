import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { CategoriesModule } from "./categories/categories.module";
import { PaymentsModule } from "./payments/payments.module";

/**
 * Корневой модуль приложения.
 *
 * Собирает конфигурацию и все функциональные модули. `.env` лежит в корне монорепо, а не
 * рядом с приложением, поэтому путь задан явно; `expandVariables` разворачивает
 * `${POSTGRES_*}` внутри `DATABASE_URL`.
 *
 * `UsersModule` подключён здесь ради регистрации CQRS-хэндлеров — напрямую его не импортирует
 * никто.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env"],
      // Разворачивает ${POSTGRES_*} внутри DATABASE_URL при загрузке .env.
      expandVariables: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    TransactionsModule,
    CategoriesModule,
    PaymentsModule,
  ],
})
export class AppModule {}
