import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard для защищённых маршрутов: пропускает запрос только с валидным Bearer-токеном.
 *
 * Проверку выполняет passport-стратегия `jwt` (`JwtStrategy`); при успехе её результат
 * попадает в `request.user`, откуда его достаёт `@CurrentUser()`. При отсутствующем,
 * истёкшем или неверном токене — `UnauthorizedException` (401).
 *
 * Guard экспортируется из `AuthModule`, поэтому модуль-потребитель обязан импортировать
 * `AuthModule`. Глобального guard'а нет: `/api/auth/register` и `/api/auth/login` публичны.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
