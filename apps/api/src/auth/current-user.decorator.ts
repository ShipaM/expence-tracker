import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "./jwt.strategy";

/**
 * Параметр-декоратор: подставляет в аргумент метода `userId` текущего пользователя.
 *
 * Значение берётся из `request.user`, который проставил `JwtStrategy.validate`, — то есть
 * применим только на маршрутах под `JwtAuthGuard`; без guard'а `request.user` не заполнен.
 *
 * @param _data Аргумент декоратора — не используется.
 * @param ctx Контекст выполнения Nest, из него достаётся HTTP-запрос.
 * @returns Идентификатор пользователя из токена.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
  return request.user.userId;
});
