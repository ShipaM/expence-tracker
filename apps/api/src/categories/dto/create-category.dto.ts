import { IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  // color необязателен: в БД дефолт #6366f1. HEX вида #a1b2c3.
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "Ожидается HEX-цвет вида #a1b2c3" })
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;
}
