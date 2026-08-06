import { ApiPropertyOptional } from "@nestjs/swagger";
import { TransactionType } from "@repo/db";
import { Type } from "class-transformer";
import { IsEnum, IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

/**
 * Query-параметры `GET /api/transactions`: фильтры и пагинация, все необязательны.
 * `userId` сюда не входит — он приходит из токена.
 */
export class QueryTransactionsDto {
  /** Нижняя граница даты (включительно), ISO-8601. */
  @ApiPropertyOptional({ format: "date-time", example: "2026-08-01T00:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  /** Верхняя граница даты (включительно), ISO-8601. */
  @ApiPropertyOptional({ format: "date-time", example: "2026-08-31T23:59:59.999Z" })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  /** Фильтр по типу операции. */
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  /** Фильтр по UUID категории. */
  @ApiPropertyOptional({ format: "uuid", example: "3f1a7c4e-9b2d-4a15-8c3e-2d6f0b7a1e94" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Номер страницы, от 1; дефолт (1) проставляет сервис. */
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Размер страницы, 1–100; дефолт (20) проставляет сервис. */
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
