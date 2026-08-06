import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CqrsModule } from "@nestjs/cqrs";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtStrategy } from "./jwt.strategy";

/**
 * Модуль авторизации: `/api/auth`, JWT-стратегия и `JwtAuthGuard`.
 *
 * `UsersModule` сюда не импортируется намеренно: хэндлеры команд/запросов регистрируются
 * глобально через `CqrsModule`, а он подключён в `AppModule`. Это не забытый импорт —
 * не добавляйте его.
 *
 * Токены подписываются секретом `JWT_SECRET` и живут 7 дней. `JwtAuthGuard` экспортируется,
 * поэтому любой модуль с защищённым контроллером обязан импортировать `AuthModule`.
 */
@Module({
  imports: [
    CqrsModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "7d" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
