import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "./jwt.strategy";

// Достаёт userId из request.user, который проставил JwtStrategy.validate.
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
  return request.user.userId;
});
