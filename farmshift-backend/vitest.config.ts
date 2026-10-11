import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_PATH: ':memory:',
      ENV_PROVIDER: 'synthetic',
      NDVI_ENABLED: 'false',
      LOG_LEVEL: 'silent',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
    },
  },
});
