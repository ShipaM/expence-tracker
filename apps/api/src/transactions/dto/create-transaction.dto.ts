import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TransactionType } from "@repo/db";
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

/** Тело `POST /api/transactions`. Проверяется глобальным ValidationPipe (class-validator). */
export class CreateTransactionDto {
  /** Сумма строкой, до двух знаков после точки: в БД Decimal, а JSON-число теряет копейки. */
  @ApiProperty({
    example: "1234.56",
    pattern: "^\\d+(\\.\\d{1,2})?$",
    description: "Сумма строкой, до двух знаков после точки: JSON-число теряет копейки",
  })
  @Matches(/^\d+(\.\d{1,2})?$/, { message: "Ожидается сумма вида 1234.56" })
  amount!: string;

  /** Тип операции: доход или расход. */
  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type!: TransactionType;

  /** Необязательный комментарий, до 500 символов. */
  @ApiPropertyOptional({ maxLength: 500, example: "Обед в кафе" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Дата операции в формате ISO-8601. */
  @ApiProperty({ format: "date-time", example: "2026-08-06T00:00:00.000Z" })
  @IsISO8601()
  date!: string;

  /** UUID категории; она должна принадлежать тому же пользователю. */
  @ApiProperty({
    format: "uuid",
    example: "3f1a7c4e-9b2d-4a15-8c3e-2d6f0b7a1e94",
    description: "Категория должна принадлежать тому же пользователю",
  })
  @IsUUID()
  categoryId!: string;
}
