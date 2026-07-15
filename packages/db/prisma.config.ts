import path from "node:path";
import { config as loadEnv } from "dotenv";
import { expand } from "dotenv-expand";
import { defineConfig, env } from "prisma/config";

// .env лежит в корне монорепо, а prisma запускается из packages/db —
// поэтому путь задаём явно, иначе DATABASE_URL не резолвится.
// expand разворачивает ${POSTGRES_*} внутри DATABASE_URL (dotenv сам этого не делает).
expand(loadEnv({ path: path.join(__dirname, "..", "..", ".env") }));

// В Prisma 7 подключение к БД задаётся здесь, а не в datasource блоке schema.prisma.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
