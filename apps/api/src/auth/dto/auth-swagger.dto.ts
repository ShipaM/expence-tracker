import { ApiProperty } from "@nestjs/swagger";
import type { AuthResponseDto, LoginDto, RegisterDto, UserDto } from "@repo/shared";

/**
 * Схемы запросов и ответов `/api/auth` для Swagger.
 *
 * Auth валидируется zod-схемами из `@repo/shared`, а не class-validator, поэтому у Nest нет
 * метаданных о телах запросов — эти классы нужны только для документации и подставляются
 * через `@ApiBody`/`@ApiResponse`. В рантайме они не участвуют: проверяет по-прежнему
 * `ZodValidationPipe`.
 *
 * Классы `implements` те же типы, что отдаёт сервис, поэтому разойтись с контрактом молча
 * не смогут — расхождение поймает `typecheck`. Ограничения полей продублированы из
 * `registerSchema`/`loginSchema`; меняете схему — поправьте и здесь.
 */

/** Тело `POST /api/auth/register`. */
export class RegisterRequestDto implements RegisterDto {
  @ApiProperty({ format: "email", example: "user@example.com" })
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 120, example: "Иван" })
  name!: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 72,
    example: "correct-horse-battery",
    description: "72 — предел bcrypt: байты сверх него обрезаются, поэтому длиннее не принимаем",
  })
  password!: string;
}

/** Тело `POST /api/auth/login`. */
export class LoginRequestDto implements LoginDto {
  @ApiProperty({ format: "email", example: "user@example.com" })
  email!: string;

  @ApiProperty({ minLength: 1, example: "correct-horse-battery" })
  password!: string;
}

/** Публичный профиль пользователя: хэш пароля бэкенд не покидает. */
export class UserResponseDto implements UserDto {
  @ApiProperty({ format: "uuid", example: "b5d9f0c1-3e7a-4f28-9a6d-8c1e2b4f7a30" })
  id!: string;

  @ApiProperty({ format: "email", example: "user@example.com" })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: "Иван" })
  name!: string | null;
}

/** Ответ на регистрацию и вход. */
export class AuthResponseSchemaDto implements AuthResponseDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT со сроком жизни 7 дней; передаётся как Authorization: Bearer <token>",
  })
  accessToken!: string;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}
