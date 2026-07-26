import { TransactionType } from "@repo/db";
import { IsEnum, IsISO8601, IsOptional, IsUUID } from "class-validator";

export class QueryTransactionsDto {
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
