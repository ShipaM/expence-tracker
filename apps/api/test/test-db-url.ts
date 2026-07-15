import path from "node:path";
import { config as loadEnv } from "dotenv";
import { expand } from "dotenv-expand";

// expand разворачивает ${POSTGRES_*} внутри DATABASE_URL/TEST_DATABASE_URL.
expand(loadEnv({ path: path.join(__dirname, "..", "..", "..", ".env") }));

// e2e чистит таблицы между кейсами, поэтому боевая БД под них не годится.
// Берём TEST_DATABASE_URL, а если его нет — выводим имя из DATABASE_URL с суффиксом _test.
export function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("Нужен DATABASE_URL или TEST_DATABASE_URL");
  }

  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "") || "postgres";
  if (name.endsWith("_test")) {
    return base;
  }

  url.pathname = `/${name}_test`;
  return url.toString();
}
