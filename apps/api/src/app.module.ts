import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { CategoriesModule } from "./categories/categories.module";

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
  ],
})
export class AppModule {}
