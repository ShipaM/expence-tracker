import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createPrismaClient, PrismaClient } from "@repo/db";

/**
 * Единственная точка доступа к БД в приложении.
 *
 * Сервис *содержит* клиент (`prisma.client`), а не наследует его: Prisma 7 требует driver
 * adapter, и клиент создаётся фабрикой `createPrismaClient()` из `@repo/db`.
 * Подключение открывается на старте модуля и закрывается на его остановке.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /** Клиент Prisma с настроенным driver adapter — через него идут все запросы. */
  readonly client: PrismaClient = createPrismaClient();

  /**
   * Хук Nest: открывает соединение с БД при инициализации модуля.
   *
   * @returns Промис, который резолвится после установки соединения.
   * @throws {Error} БД недоступна или `DATABASE_URL` неверен — приложение не стартует.
   */
  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  /**
   * Хук Nest: закрывает соединение при остановке приложения.
   *
   * @returns Промис, который резолвится после разрыва соединения.
   */
  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
