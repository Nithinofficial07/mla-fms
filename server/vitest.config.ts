import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@mla/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'mongodb://127.0.0.1:27017/placeholder',
      JWT_SECRET: 'test-secret-test-secret-0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcd',
      STORAGE_PROVIDER: 'local',
      LOCAL_STORAGE_DIR: './.vitest/storage',
      FRONTEND_URL: 'http://localhost:5173',
      BACKEND_URL: 'http://localhost:4000',
    },
  },
});
