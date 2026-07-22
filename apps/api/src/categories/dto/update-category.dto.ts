import { IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "Ожидается HEX-цвет вида #a1b2c3" })
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;
}
