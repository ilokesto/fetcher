# @ilokesto/fetcher

This directory contains the `@ilokesto/fetcher` package in the ilokesto pnpm monorepo.

## What this package is

A type-safe HTTP client facade with OpenAPI awareness, built on top of `ky`.

## When modifying this package

1. Read the root `AGENTS.md`, `PACKAGES.md`, and `ARCHITECTURE.md`.
2. Load the `ilokesto-fetcher` skill from `.opencode/skills/ilokesto-fetcher/SKILL.md`.
3. Preserve `ky`'s runtime ergonomics while adding TypeScript/OpenAPI conveniences.
4. Run `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:dist` before committing.
5. Add a changeset with `pnpm changeset` for any consumer-facing change.

## Release flow

1. Open a PR with a root changeset.
2. After CI passes on `main`, the root workflow's release job opens a `ci: release` PR and publishes this package with the `beta` dist-tag.
3. Merge the release PR to publish to npm.

## Must not do

- Do not add internal ilokesto dependencies; this package is standalone.
- Do not break the public `ky`-like API without a major version bump.
