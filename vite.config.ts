import { defineConfig, defaultExclude } from 'vite-plus'

export default defineConfig({
  // Live e2e tests run only via `npm run test:e2e` (tests/e2e/vitest.config.ts).
  test: { exclude: [...defaultExclude, 'tests/e2e/**'] },
  fmt: {
    semi: false,
    singleQuote: true,
    ignorePatterns: ['dist/**', '**/*.md'],
  },
  lint: {
    ignorePatterns: ['dist/**'],
    jsPlugins: [{ name: 'local', specifier: './tooling/oxlint-plugin-local.js' }],
    rules: {
      'local/padding-lines': 'error',
      'local/no-inline-exports': 'error',
      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
      curly: ['error', 'all'],
    },
    options: { typeAware: true, typeCheck: false },
  },
  pack: {
    entry: ['bin/climail.ts'],
    format: ['es'],
    platform: 'node',
    target: 'node22',
  },
  // Pre-commit: format + lint the staged sources (auto-fixing), then run the
  // tests that import them. Installed as a Git hook via `vp config`.
  staged: {
    '*.{ts,js}': ['vp check --fix', 'vp test related --run'],
  },
})
