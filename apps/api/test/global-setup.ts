import { execSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { resolveTestDatabaseUrl } from "./test-db-url";

const DB_PACKAGE = path.join(__dirname, "..", "..", "..", "packages", "db");

// Создаём тестовую БД (если её нет) и накатываем миграции — один раз на весь прогон.
export default async function setup(): Promise<void> {
  const testUrl = resolveTestDatabaseUrl();
  const url = new URL(testUrl);
  const dbName = url.pathname.replace(/^\//, "");

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) {
    // Имя БД нельзя передать параметром — оно приходит из нашего же .env, не из запроса.
    await admin.query(`CREATE DATABASE "${dbName}"`);
  }
  await admin.end();

  execSync("npx prisma migrate deploy", {
    cwd: DB_PACKAGE,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
