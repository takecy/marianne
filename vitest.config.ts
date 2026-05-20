import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/setup.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/**/*.module.css.d.ts",
      ],
      // Thresholds intentionally omitted: coverage is introduced as an
      // observability metric, not a gating signal. Per-directory
      // thresholds for pure-logic modules can be added later once a
      // baseline is established.
    },
  },
});
