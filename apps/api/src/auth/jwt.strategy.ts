import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

/** Полезная нагрузка JWT: `sub` — идентификатор пользователя, `email` — его почта. */
export interface JwtPayload {
  sub: string;
  email: string;
}

/** То, что Passport кладёт в `request.user` после успешной проверки токена. */
export interface AuthUser {
  userId: string;
  email: string;
}

/**
 * Passport-стратегия проверки Bearer-токена: подпись, срок жизни и разбор payload.
 *
 * Токен читается из заголовка `Authorization`, истёкшие не принимаются.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * @param config Конфигурация Nest; из неё читается `JWT_SECRET`.
   * @throws {Error} `JWT_SECRET` не задан — приложение падает сразу при старте, а не на
   *   первом запросе.
   */
  constructor(config: ConfigService) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error(
        "JWT_SECRET не задан. Допишите его в .env в корне монорепо " +
          "(образец — в .env.example) и перезапустите api.",
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Превращает проверенный payload в объект, который Passport кладёт в `request.user`.
   *
   * Вызывается только после успешной проверки подписи и срока — существование пользователя
   * в БД здесь не проверяется (это делают сервисы через `GetUserByIdQuery`).
   *
   * @param payload Расшифрованное содержимое токена.
   * @returns `{ userId, email }` — то, что увидит `@CurrentUser()`.
   */
  validate(payload: JwtPayload): AuthUser {
    return { userId: payload.sub, email: payload.email };
  }
}
