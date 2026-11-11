import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  // Several suites run whole backtest grids / training loops; allow for CPU contention when files run in parallel.
  test: { include: ['lab/**/*.test.ts'], environment: 'node', testTimeout: 60_000 },
});
