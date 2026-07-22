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
  // class-validator для DTO-классов (категории). zod-контроллеры (auth, expenses) не
  // затрагиваются: их @Body-типы — z.infer-алиасы, в рантайме метатип Object, и пайп их пропускает.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API слушает http://localhost:${port}/api`);
}

void bootstrap();
