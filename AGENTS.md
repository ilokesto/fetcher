# @ilokesto/fetcher

This repository owns one public library.
Use Node 24.22.1 and pnpm 10.17.1. Run commands from this root.

- Keep the ky-compatible core and OpenAPI exports intact.
- Library source is in `src/`; tests are in `tests/unit`, `tests/types`, `tests/tooling`, and `tests/fixtures`.
- Keep other libraries as registry dependencies. Only this library and private workspaces
  inside this repository may use workspace links.
- Run `pnpm typecheck` and `pnpm test`; the aggregate builds and runs every test suite once.
- Individual suites: `test:unit`, `test:types`, `test:tooling`, and `test:pack` (requires a build).
- Consumer-facing changes need a root Changeset.
- `release:verify --sha <full-SHA>` is read-only. Main merges maintain the Changesets release PR; merging
  it publishes only the exact successful Verify artifact through GitHub Actions with the
  beta dist-tag. Never publish locally.
- Before rollout, enable `Allow GitHub Actions to create and approve pull requests`
  and configure `NPM_TOKEN` in the `Production` environment.
