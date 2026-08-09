import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Валидация входных данных zod-схемой — способ по умолчанию в этом проекте.
 *
 * Схемы берём из `@repo/shared`, чтобы фронт и бэк валидировали одно и то же.
 *
 * Вешать пайп нужно **на параметр** — `@Body(new ZodValidationPipe(schema))`. Через
 * `@UsePipes(...)` на методе он применится ко всем аргументам, включая строковые
 * path/query-параметры, и упадёт с «expected object, received string».
 *
 * @typeParam T Тип, который схема возвращает после разбора.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  /** @param schema Схема, по которой проверяется значение. */
  constructor(private readonly schema: ZodType<T>) {}

  /**
   * Проверяет значение схемой и возвращает разобранные данные.
   *
   * @param value Сырое значение из запроса.
   * @returns Значение, приведённое схемой к типу `T`.
   * @throws {BadRequestException} Значение не прошло схему; в теле ответа — `message`
   *   и массив `issues` от zod.
   */
  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: "Ошибка валидации",
        issues: result.error.issues,
      });
    }

    return result.data;
  }
}
