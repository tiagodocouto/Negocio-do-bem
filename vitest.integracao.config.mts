import { defineConfig } from "vitest/config";
import configuracao from "./vitest.config.mjs";

export default defineConfig({
  ...configuracao,
  test: {
    ...configuracao.test,
    include: ["tests/integracao/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    passWithNoTests: false,
  },
});
