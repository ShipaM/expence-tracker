import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

/**
 * Точка входа: поднимает Nest-приложение на `PORT` (по умолчанию 3001).
 *
 * Здесь же задаются CORS, глобальный префикс `/api`, глобальный `ValidationPipe` и Swagger UI.
 * Порядок важен: документ Swagger строится после `setGlobalPrefix`, иначе пути в нём окажутся
 * без `/api`.
 *
 * @returns Промис, который резолвится, когда сервер начал слушать порт.
 * @throws {Error} `JWT_SECRET` не задан (падает `JwtStrategy` при инициализации) или порт занят.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
  app.setGlobalPrefix("api");
  // class-validator для DTO-классов (категории, транзакции). zod-контроллеры (auth) не
  // затрагиваются: их @Body-типы — z.infer-алиасы, в рантайме метатип Object, и пайп их пропускает.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // вырезает из payload поля, которых нет в DTO (нет декоратора валидации)
      forbidNonWhitelisted: true, // и не просто вырезает, а бросает 400, если такие поля пришли
      transform: true, // приводит payload к типу DTO-класса (plain object → instance) и кастит примитивы
    }),
  );

  // Документ строится после setGlobalPrefix, поэтому пути в нём уже с /api.
  // Кнопка Authorize принимает голый JWT — префикс "Bearer " Swagger UI добавляет сам.
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Expense Tracker API")
    .setDescription("Доходы и расходы: транзакции, категории, авторизация")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API слушает http://localhost:${port}/api`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

void bootstrap();
