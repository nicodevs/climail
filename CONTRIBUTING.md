# Contributing

The source is TypeScript (`bin/`, `commands/`, `lib/`), and the toolchain is [Vite+](https://vite-plus.dev) (`vp`) — one binary for lint, format, test, and build.

```bash
npm install        # installs deps and (via prepare) the git hooks
```

`vp` ships as the `vite-plus` dev dependency. The npm scripts resolve it from `node_modules`; to call it directly without a global install, prefix with `npx` (e.g. `npx vp lint`).

Everyday commands — call `vp` directly, or use the npm script wrappers:

| Task | `vp` | npm script |
|------|------|------------|
| Lint | `vp lint` | `npm run lint` |
| Format | `vp fmt` | `npm run format` |
| Type-check | `tsc --noEmit` | `npm run type-check` |
| Test | `vp test run` | `npm test` |
| Lint + format + related tests | `vp check --fix` | — |
| Build | `vp run type-check && vp pack` | `npm run build` |

`vp check --fix` runs format + lint together; `vp test related --run <file>` runs only the tests importing a changed file.

**Build.** `npm run build` type-checks (`tsc --noEmit`) then bundles `bin/climail.ts` into `dist/climail.mjs` via `vp pack` — runtime deps stay external, the shebang is preserved. `dist/` is gitignored; it's produced at publish time (`prepublishOnly`), so the tarball ships compiled JS, never `.ts`.

**Run your changes.** Node can't execute `.ts` directly, so build first:

```bash
npm run build && node dist/climail.mjs list --unread
```

**Commit hooks.** A pre-commit hook (installed by `vp config`, re-run automatically on `npm install`) runs `vp check --fix` and the related tests on staged files. Set `VITE_GIT_HOOKS=0` to skip installation in an environment without Git.

**Adding a command.** Create `commands/foo.ts` (declare, then `export { foo }` in a single block at the bottom — no inline exports), wire it into the `commands` map in `bin/climail.ts`, and add a `tests/foo.test.ts`.

**Notes on relative imports.** Under NodeNext, keep the `.js` extension on relative import specifiers even from `.ts` files (`import { list } from '../commands/list.js'`) — this is correct, not a typo.

## Releases

Releases are automated — you don't bump the version by hand. Every push to `main` runs `.github/workflows/publish.yml`, which bumps the patch version, commits and tags it, and publishes to npm. Just land your change on `main` and the release follows.
