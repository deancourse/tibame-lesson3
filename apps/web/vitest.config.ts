import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      css: false,
      coverage: {
        provider: "v8",
        reportsDirectory: "./coverage",
        reporter: ["text", "lcov", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "coverage/**",
          "dist/**",
          "src/**/*.test.{ts,tsx}",
          "src/test/**",
          "vite.config.ts",
          "vitest.config.ts",
          "vitest.setup.ts",
        ],
      },
    },
  }),
);
