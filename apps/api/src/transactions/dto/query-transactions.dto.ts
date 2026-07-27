import { TransactionType } from "@repo/db";
import { Type } from "class-transformer";
import { IsEnum, IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

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

  // Пагинация: page/limit опциональны; дефолты (1/20) проставляет сервис.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
