import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest 4 трансформирует код через Oxc, а он не умеет emitDecoratorMetadata.
  // Отключаем его и отдаём трансформацию swc — иначе Nest не соберёт типы для DI.
  oxc: false,
  test: {
    globals: true,
    environment: "node",
    root: "./",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.module.ts", "src/main.ts"],
    },
  },
  // Vitest использует esbuild, а он не умеет emitDecoratorMetadata —
  // без swc DI в Nest не соберёт типы конструкторов.
  plugins: [swc.vite({ module: { type: "es6" } })],
});
