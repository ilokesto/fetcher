# Changesets

This directory contains [Changesets](https://github.com/changesets/changesets) configuration for `@ilokesto/store`.

## When to add a changeset

Add a changeset for any change that affects consumers of the library:

- New features
- Bug fixes
- Breaking changes
- Performance improvements
- Deprecations

Trivial changes (typo fixes in internal comments, test-only changes, dependency updates with no consumer impact) usually do not need a changeset.

## How to add a changeset

```bash
pnpm changeset
```

Follow the prompts to select the bump type (`patch`, `minor`, or `major`) and write a concise summary. The tool will create a Markdown file in this directory.

## Bump types

- `patch`: Bug fixes and small improvements that do not change the public API.
- `minor`: New features that are backward-compatible.
- `major`: Breaking changes that require consumers to update their code.
