import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

/** Тело `POST /api/categories`. Проверяется глобальным ValidationPipe (class-validator). */
export class CreateCategoryDto {
  /** Имя категории, 1–60 символов; уникально в пределах пользователя. */
  @ApiProperty({
    minLength: 1,
    maxLength: 60,
    example: "Продукты",
    description: "Уникально в пределах пользователя",
  })
  @IsString()
  @Length(1, 60)
  name!: string;

  /** HEX-цвет вида `#a1b2c3`. Необязателен: в БД дефолт `#6366f1`. */
  @ApiPropertyOptional({
    pattern: "^#[0-9a-fA-F]{6}$",
    example: "#a1b2c3",
    default: "#6366f1",
    description: "Без значения в БД подставляется дефолт",
  })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "Ожидается HEX-цвет вида #a1b2c3" })
  color?: string;

  /** Имя иконки, до 40 символов. */
  @ApiPropertyOptional({ maxLength: 40, example: "shopping-cart" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;
}
