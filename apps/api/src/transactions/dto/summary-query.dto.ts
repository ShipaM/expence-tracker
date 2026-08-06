import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

/**
 * Query-параметры `GET /api/transactions/summary`: оба обязательны.
 * Глобальный ValidationPipe (`transform: true`) приводит query-строки к числам.
 */
export class SummaryQueryDto {
  /** Месяц, 1–12 (январь — 1). */
  @ApiProperty({ minimum: 1, maximum: 12, example: 8, description: "Январь — 1" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  /** Год, 2000–2100. */
  @ApiProperty({ minimum: 2000, maximum: 2100, example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}
