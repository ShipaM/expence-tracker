import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import {
  loginSchema,
  registerSchema,
  type AuthResponseDto,
  type LoginDto,
  type RegisterDto,
  type UserDto,
} from "@repo/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
  ): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() userId: string): Promise<UserDto> {
    return this.auth.me(userId);
  }
}
