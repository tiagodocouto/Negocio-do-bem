import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // O pacote server-only quebra fora do Next; nos testes ele não faz nada.
      "server-only": path.resolve(import.meta.dirname, "tests/server-only.ts"),
    },
  },
  test: {
    include: ["tests/{unit,db}/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Os testes de banco compartilham o mesmo Postgres de teste.
    fileParallelism: false,
  },
});
