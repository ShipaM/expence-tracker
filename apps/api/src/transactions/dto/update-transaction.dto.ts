import { ApiPropertyOptional } from "@nestjs/swagger";
import { TransactionType } from "@repo/db";
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

/**
 * Тело `PATCH /api/transactions/:id`: все поля необязательны, непереданные остаются как были.
 */
export class UpdateTransactionDto {
  /** Новая сумма строкой, до двух знаков после точки. */
  @ApiPropertyOptional({ example: "1234.56", pattern: "^\\d+(\\.\\d{1,2})?$" })
  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: "Ожидается сумма вида 1234.56" })
  amount?: string;

  /** Новый тип операции: доход или расход. */
  @ApiPropertyOptional({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  /** Новый комментарий, до 500 символов. */
  @ApiPropertyOptional({ maxLength: 500, example: "Обед в кафе" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Новая дата операции в формате ISO-8601. */
  @ApiPropertyOptional({ format: "date-time", example: "2026-08-06T00:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  date?: string;

  /** UUID новой категории; она должна принадлежать тому же пользователю. */
  @ApiPropertyOptional({ format: "uuid", example: "3f1a7c4e-9b2d-4a15-8c3e-2d6f0b7a1e94" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
