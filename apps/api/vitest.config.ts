import { defineConfig } from "vitest/config";

// The live suites need the .env at the repo root; unit tests do not.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url).pathname);
} catch {
  // no .env: only the unit tests can pass
}

export default defineConfig({
  test: { testTimeout: 90_000, hookTimeout: 30_000, fileParallelism: false },
});
