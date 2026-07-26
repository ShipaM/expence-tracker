import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

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

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API слушает http://localhost:${port}/api`);
}

void bootstrap();
