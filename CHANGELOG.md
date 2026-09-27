# @ilokesto/fetcher

## 1.0.0

### Minor Changes

- 4f7e245: Add OpenAPI-aware typed HEAD shortcuts while keeping OPTIONS on the callable client surface.

### Patch Changes

- c850635: Introduce Changesets for automated versioning and changelog management
- d483084: Relax `PathsLike` constraint from `Record<string, ...>` to `object` so canonical OpenAPI generators (e.g. `openapi-typescript`) that emit `interface paths { '/users': ... }` satisfy the generic constraint. TypeScript interfaces do not have implicit string index signatures, so the previous `Record<string, ...>` constraint rejected them.
- bb26d48: Point package repository links to the ilokesto organization monorepo and update the fetcher homepage before retiring the legacy repositories.
