import { TransactionType } from "@repo/db";
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

export class CreateTransactionDto {
  // Сумма приходит строкой: в БД Decimal, а JSON-число теряет точность на копейках.
  @Matches(/^\d+(\.\d{1,2})?$/, { message: "Ожидается сумма вида 1234.56" })
  amount!: string;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsISO8601()
  date!: string;

  @IsUUID()
  categoryId!: string;
}
