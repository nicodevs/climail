import { defineConfig, defaultExclude } from 'vite-plus'

// Runs only the live e2e tests, against a real server via tests/e2e/climail.conf.
// Invoked by `npm run test:e2e`; the default suite excludes this directory.
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    exclude: defaultExclude,
    testTimeout: 90_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
})
