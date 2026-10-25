import { defineConfig } from 'vitest/config'

// The app is CommonJS; only the tests use `import` (Vitest itself cannot be require()d).
export default defineConfig({
    test: {
        // One in-memory MongoDB replica set for the whole run (see test/helpers/global-setup.mjs).
        globalSetup: ['test/helpers/global-setup.mjs'],
        // First run downloads the mongod binary, which can take a while.
        hookTimeout: 120_000,
        testTimeout: 30_000,
        env: {
            STAGE: 'test',
            JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
            JWT_EXPIRES_IN: '1h',
            DEV_TOKEN_ENDPOINT: 'true',
        },
    },
})
