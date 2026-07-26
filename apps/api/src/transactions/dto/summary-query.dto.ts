import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

// month и year обязательны; глобальный ValidationPipe (transform: true) приводит query-строки к числам.
export class SummaryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}
