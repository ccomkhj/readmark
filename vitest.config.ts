import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The HTTP API is the only automated test seam (spec: Testing Decisions).
    include: ["test/api/**/*.test.ts"],
    environment: "node",
  },
});
