import { ApiProperty } from "@nestjs/swagger";
import type { PaginatedTransactionsDto, TransactionDto } from "@repo/shared";
import { TRANSACTION_TYPES, type TransactionType } from "@repo/shared";
import { CategoryResponseDto } from "../../categories/dto/category-response.dto";

/**
 * Схемы ответов для Swagger.
 *
 * Типы ответов в `@repo/shared` — интерфейсы, а Swagger читает метаданные только с классов.
 * Поэтому здесь классы, которые `implements` те же интерфейсы: разойтись с контрактом они не
 * могут — это поймает `typecheck`. В рантайме классы не используются, только как `type` в
 * `@ApiResponse`.
 *
 * Вложенная категория переиспользует `CategoryResponseDto` из модуля категорий — это тот же
 * `CategoryDto`, дублировать схему незачем.
 */

/** Транзакция в ответе API. */
export class TransactionResponseDto implements TransactionDto {
  @ApiProperty({ format: "uuid", example: "8c2b1d90-5f7a-4e63-b0d8-1a4c9e2f6b57" })
  id!: string;

  @ApiProperty({
    example: "1234.56",
    description: "Строка, а не число: в БД Decimal(12,2), а JSON-число теряет копейки",
  })
  amount!: string;

  @ApiProperty({ enum: TRANSACTION_TYPES, example: "EXPENSE" })
  type!: TransactionType;

  @ApiProperty({ type: String, nullable: true, example: "Обед в кафе" })
  description!: string | null;

  @ApiProperty({ format: "date-time", example: "2026-08-06T00:00:00.000Z" })
  date!: string;

  @ApiProperty({ type: CategoryResponseDto })
  category!: CategoryResponseDto;

  @ApiProperty({ format: "date-time", example: "2026-08-06T12:34:56.789Z" })
  createdAt!: string;
}

/** Страница транзакций: сами записи плюс метаданные пагинации. */
export class PaginatedTransactionsResponseDto implements PaginatedTransactionsDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  items!: TransactionResponseDto[];

  @ApiProperty({ description: "Всего записей по фильтру, без учёта пагинации", example: 137 })
  total!: number;

  @ApiProperty({ minimum: 1, example: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100, example: 20 })
  limit!: number;
}
