import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

// Схемы берём из @repo/shared, чтобы фронт и бэк валидировали одно и то же.
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

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
