import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import {
  loginSchema,
  registerSchema,
  type AuthResponseDto,
  type LoginDto,
  type RegisterDto,
  type UserDto,
} from "@repo/shared";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import {
  AuthResponseSchemaDto,
  LoginRequestDto,
  RegisterRequestDto,
  UserResponseDto,
} from "./dto/auth-swagger.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

/**
 * HTTP-эндпоинты `/api/auth`.
 *
 * `register` и `login` публичны — глобального guard'а в приложении нет, и добавлять его сюда
 * нельзя. Тела валидируются zod-схемами из `@repo/shared` через `ZodValidationPipe`,
 * навешанный **на параметр**: через `@UsePipes` он применился бы и к другим аргументам.
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  /** @param auth Сервис авторизации. */
  constructor(private readonly auth: AuthService) {}

  /**
   * `POST /api/auth/register` — регистрация. Публичный эндпоинт.
   *
   * @param dto Тело запроса: `email`, `name`, `password` (8–72 символа).
   * @returns Токен доступа и профиль созданного пользователя (201).
   * @throws {BadRequestException} 400: тело не прошло zod-схему (в ответе — `issues`).
   * @throws {ConflictException} 409: email уже занят.
   */
  @ApiOperation({
    summary: "Регистрация",
    description:
      "Публичный эндпоинт. Пароль хэшируется bcrypt и наружу никогда не возвращается. " +
      "Тело проверяется zod-схемой, поэтому в ответе 400 приходит массив issues.",
  })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({ status: 201, description: "Пользователь создан", type: AuthResponseSchemaDto })
  @ApiResponse({ status: 400, description: "Тело не прошло валидацию" })
  @ApiResponse({ status: 409, description: "Email уже занят" })
  @Post("register")
  register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
  ): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  /**
   * `POST /api/auth/login` — вход. Публичный эндпоинт; отвечает 200, а не 201.
   *
   * @param dto Тело запроса: `email` и `password`.
   * @returns Токен доступа и профиль пользователя.
   * @throws {BadRequestException} 400: тело не прошло zod-схему.
   * @throws {UnauthorizedException} 401: неверный email или пароль.
   */
  @ApiOperation({
    summary: "Вход",
    description:
      "Публичный эндпоинт, отвечает 200. При неверном email и при неверном пароле ответ " +
      "одинаковый — чтобы не подсказывать, какие адреса зарегистрированы.",
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({ status: 200, description: "Токен и профиль", type: AuthResponseSchemaDto })
  @ApiResponse({ status: 400, description: "Тело не прошло валидацию" })
  @ApiResponse({ status: 401, description: "Неверный email или пароль" })
  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto);
  }

  /**
   * `GET /api/auth/me` — профиль владельца токена. Единственный защищённый метод контроллера.
   *
   * @param userId Идентификатор пользователя из токена.
   * @returns Профиль без хэша пароля.
   * @throws {UnauthorizedException} 401: токена нет/он неверен либо пользователя больше нет в БД.
   */
  @ApiOperation({
    summary: "Профиль текущего пользователя",
    description: "Единственный защищённый метод контроллера.",
  })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: "Профиль владельца токена", type: UserResponseDto })
  @ApiResponse({
    status: 401,
    description: "Токена нет/он неверен либо пользователя из токена больше нет в БД",
  })
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() userId: string): Promise<UserDto> {
    return this.auth.me(userId);
  }
}
