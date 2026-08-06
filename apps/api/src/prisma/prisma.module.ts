import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Глобальный модуль доступа к БД: `PrismaService` доступен во всех модулях приложения
 * без явного импорта — поэтому `TransactionsModule` его не импортирует.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
