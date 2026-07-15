import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import { resolveTestDatabaseUrl } from "./test/test-db-url";

export default defineConfig({
  // Как и в юнит-конфиге: Oxc не умеет emitDecoratorMetadata, DI в Nest без swc не работает.
  oxc: false,
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.e2e-spec.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Тесты делят одну БД и чистят таблицы — параллельный запуск их перемешает.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: resolveTestDatabaseUrl(),
      NODE_ENV: "test",
    },
  },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
