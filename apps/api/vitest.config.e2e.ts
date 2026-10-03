import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // E2E files ek-ek karke: sab same database share karte hain (assignment engine
    // "koi bhi eligible customer" uthata hai — parallel files ek doosre ka data le lengi)
    fileParallelism: false,
  },
});
