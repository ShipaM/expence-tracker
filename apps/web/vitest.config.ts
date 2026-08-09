import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // В tsconfig стоит jsx: "preserve" (так нужно Next), поэтому JSX для тестов
  // трансформирует плагин, а не встроенный трансформер Vitest.
  plugins: [react()],
  test: {
    globals: true,
    // Компоненты рендерятся в DOM — node-окружения недостаточно.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/app/**", "src/**/index.ts"],
    },
  },
  resolve: {
    // Тот же алиас, что в tsconfig: @/* → src/*.
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
