import { Injectable, UnauthorizedException } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { JwtService } from "@nestjs/jwt";
import type { User } from "@repo/db";
import type { AuthResponseDto, LoginDto, RegisterDto, UserDto } from "@repo/shared";
import * as bcrypt from "bcryptjs";
import { CreateUserCommand } from "../users/contracts/create-user.command";
import { GetUserByEmailQuery } from "../users/contracts/get-user-by-email.query";
import { GetUserByIdQuery } from "../users/contracts/get-user-by-id.query";

/** Стоимость bcrypt-хэширования: 2^10 итераций. */
const BCRYPT_ROUNDS = 10;

/**
 * Регистрация, вход и профиль текущего пользователя.
 *
 * Хэширование/сверка пароля и подпись JWT живут здесь; Users лишь хранит хэш.
 * С модулем Users общаемся только через шину — без импорта его сервисов.
 * Хэш пароля наружу не отдаётся: ответы собираются в {@link AuthService.toUserDto}.
 */
@Injectable()
export class AuthService {
  /**
   * @param commandBus Шина команд CQRS (создание пользователя).
   * @param queryBus Шина запросов CQRS (поиск пользователя).
   * @param jwt Подпись access-токенов; срок жизни задан в `AuthModule` — 7 дней.
   */
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Регистрирует пользователя: хэширует пароль и отправляет `CreateUserCommand`.
   *
   * @param dto Email, имя и пароль (не длиннее 72 символов — предел bcrypt, проверяет схема).
   * @returns Токен доступа и профиль созданного пользователя.
   * @throws {ConflictException} Email уже занят — бросает `CreateUserHandler` по коду
   *   Prisma `P2002`.
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.commandBus.execute<CreateUserCommand, User>(
      new CreateUserCommand(dto.email, dto.name, passwordHash),
    );

    return this.buildResponse(user);
  }

  /**
   * Проверяет пару email + пароль и выдаёт токен.
   *
   * @param dto Email и пароль.
   * @returns Токен доступа и профиль пользователя.
   * @throws {UnauthorizedException} Пользователя нет либо пароль не совпал — сообщение одно
   *   и то же в обоих случаях, чтобы не подсказывать, какие email зарегистрированы.
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.queryBus.execute<GetUserByEmailQuery, User | null>(
      new GetUserByEmailQuery(dto.email),
    );

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Неверный email или пароль");
    }

    return this.buildResponse(user);
  }

  /**
   * Возвращает профиль владельца токена.
   *
   * @param userId Идентификатор пользователя из токена.
   * @returns Профиль без хэша пароля.
   * @throws {UnauthorizedException} Пользователя из токена больше нет в БД (токен живёт
   *   7 дней и мог пережить удаление аккаунта).
   */
  async me(userId: string): Promise<UserDto> {
    const user = await this.queryBus.execute<GetUserByIdQuery, User | null>(
      new GetUserByIdQuery(userId),
    );

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.toUserDto(user);
  }

  /**
   * Собирает ответ авторизации: подписывает токен и прикладывает профиль.
   *
   * @param user Запись пользователя из БД.
   * @returns Токен доступа (payload — `{ sub, email }`) и профиль.
   */
  private buildResponse(user: User): AuthResponseDto {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    return { accessToken, user: this.toUserDto(user) };
  }

  /**
   * Отсекает от записи пользователя всё, что не должно покидать бэкенд.
   *
   * @param user Запись пользователя из БД, включая `passwordHash`.
   * @returns Публичный профиль: только `id`, `email`, `name`.
   */
  private toUserDto(user: User): UserDto {
    return { id: user.id, email: user.email, name: user.name };
  }
}
