import { TransactionType } from "@repo/db";
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

export class UpdateTransactionDto {
  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: "Ожидается сумма вида 1234.56" })
  amount?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
