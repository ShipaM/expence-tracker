import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

/**
 * Тело `PATCH /api/categories/:id`: все поля необязательны, непереданные остаются как были.
 */
export class UpdateCategoryDto {
  /** Новое имя, 1–60 символов; должно оставаться уникальным у пользователя. */
  @ApiPropertyOptional({ minLength: 1, maxLength: 60, example: "Продукты" })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  /** Новый HEX-цвет вида `#a1b2c3`. */
  @ApiPropertyOptional({ pattern: "^#[0-9a-fA-F]{6}$", example: "#a1b2c3" })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "Ожидается HEX-цвет вида #a1b2c3" })
  color?: string;

  /** Новое имя иконки, до 40 символов. */
  @ApiPropertyOptional({ maxLength: 40, example: "shopping-cart" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;
}
