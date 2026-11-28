import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      // `next/cache` solo funciona dentro del runtime de Next: ver el stub.
      {
        find: /^next\/cache$/,
        replacement: fileURLToPath(new URL("./tests/stubs/next-cache.ts", import.meta.url)),
      },
      // Mismo alias que tsconfig: `@/*` apunta a la raíz del proyecto.
      { find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) },
    ],
  },
});
