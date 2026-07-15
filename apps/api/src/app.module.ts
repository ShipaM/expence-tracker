import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { ExpensesModule } from "./expenses/expenses.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env"],
      // Разворачивает ${POSTGRES_*} внутри DATABASE_URL при загрузке .env.
      expandVariables: true,
    }),
    PrismaModule,
    ExpensesModule,
  ],
})
export class AppModule {}
