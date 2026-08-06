import { ApiProperty } from "@nestjs/swagger";
import type { CategoryDto } from "@repo/shared";

/**
 * Категория в ответе API — схема для Swagger.
 *
 * `CategoryDto` в `@repo/shared` — интерфейс, а Swagger читает метаданные только с классов.
 * `implements` гарантирует, что схема не разойдётся с контрактом: расхождение поймает
 * `typecheck`. В рантайме класс не используется, только как `type` в `@ApiResponse`.
 */
export class CategoryResponseDto implements CategoryDto {
  @ApiProperty({ format: "uuid", example: "3f1a7c4e-9b2d-4a15-8c3e-2d6f0b7a1e94" })
  id!: string;

  @ApiProperty({ example: "Продукты", maxLength: 60 })
  name!: string;

  @ApiProperty({ example: "#a1b2c3", pattern: "^#[0-9a-fA-F]{6}$" })
  color!: string;

  @ApiProperty({ type: String, nullable: true, example: "shopping-cart" })
  icon!: string | null;
}
