# @ilokesto/fetcher

This repository contains the `@ilokesto/fetcher` package. It is an independent repository within the ilokesto ecosystem.

## What this package is

A type-safe HTTP client facade with OpenAPI awareness, built on top of `ky`.

## When modifying this package

1. Read the ilokesto handbook at `https://github.com/ilokesto/metarepo` (`AGENTS.md`, `PACKAGES.md`, `ARCHITECTURE.md`).
2. Load the `ilokesto-fetcher` skill from `.opencode/skills/ilokesto-fetcher/SKILL.md`.
3. Preserve `ky`'s runtime ergonomics while adding TypeScript/OpenAPI conveniences.
4. Run `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:dist` before committing.
5. Add a changeset with `pnpm changeset` for any consumer-facing change.

## Release flow

1. Open a PR with a changeset.
2. After merge to `main`, the `release.yml` workflow opens a `ci: release` PR.
3. Merge the release PR to publish to npm.

## Must not do

- Do not add internal ilokesto dependencies; this package is standalone.
- Do not break the public `ky`-like API without a major version bump.
