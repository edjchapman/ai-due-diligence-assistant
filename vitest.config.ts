import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // web component tests opt into jsdom per-file via `// @vitest-environment jsdom`.
    include: ['test/**/*.test.ts', 'web/src/**/*.test.{ts,tsx}'],
    coverage: {
      // Product code only — entrypoints/CLIs excluded, they're exercised by
      // `make demo`/`make eval`/deploys rather than unit tests.
      include: ['src/**', 'web/src/**'],
      exclude: ['src/index.ts', 'src/demo.ts', 'src/db/migrate.ts', 'web/src/main.tsx'],
    },
  },
});
