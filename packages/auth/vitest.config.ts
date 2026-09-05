import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    setupFiles: [path.resolve(packageRoot, "tests/setup-env.ts")],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
