# @ilokesto/fetcher

A thin OpenAPI-aware wrapper around ky, with typed requests and inferred JSON responses.

[![npm](https://img.shields.io/npm/v/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](https://www.npmjs.com/package/@ilokesto/fetcher)
[![License](https://img.shields.io/npm/l/@ilokesto/fetcher?style=flat&color=555&labelColor=555)](./LICENSE)

[한국어](./README.ko.md)

- Keep ky hooks, retries, `create()`, `extend()`, and lazy response parsing.
- Type route templates, grouped parameters, and JSON or form bodies from OpenAPI.
- Choose throwing requests or non-throwing `safe` results with parsed data.

## Installation

Requires Node.js 24.22.1+ and the `ky ^1.14.0` peer dependency.

```bash
pnpm add @ilokesto/fetcher ky@^1.14.0
```

## Quick start

This example defines its schema inline; point `prefixUrl` at your API.

```ts
import { createFetcher } from '@ilokesto/fetcher/openapi';

type User = { id: string; name: string };

type Paths = {
  '/users/{id}': {
    get: {
      parameters: {
        path: { id: string };
        query?: { include?: 'profile' };
      };
      responses: {
        200: { content: { 'application/json': User } };
      };
    };
  };
};

const api = createFetcher<Paths>({
  prefixUrl: 'https://api.example.com',
});

const user = await api
  .get('/users/{id}', {
    params: {
      path: { id: '42' },
      query: { include: 'profile' },
    },
  })
  .json();

console.log(user.name);
```

`.json()` infers `User` without a response generic. Use generated OpenAPI types for larger APIs.

The default client throws on HTTP failures. `params.cookie` is type-only, not automatic cookie or auth management. Typed `head` stays lazy and has no `safe.head`; OPTIONS uses the callable client, not `api.options()`.

<details>
<summary>Development</summary>

Use Node 24.22.1 and pnpm 10.17.1 from this repository root. No sibling checkout is required.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test:types
pnpm test
pnpm test:dist
pnpm test:tooling
```

`test:types` compiles the type-contract cases without executing requests; `test` runs runtime tests. `test:dist` runs after `build`: it checks entrypoint identity and packed-consumer HEAD/OPTIONS contracts.

`pnpm release:verify --sha <full-SHA>` checks live GitHub Verify evidence, its packed artifact, main, and registry state without publishing. It requires remote bootstrap and exact-SHA CI verification. Pull requests run Verify CI. Main merges create or update a Changesets release PR; merging
that PR publishes only the exact successful Verify artifact through GitHub Actions. Enable
`Allow GitHub Actions to create and approve pull requests` and configure `NPM_TOKEN` in the
`Production` environment before rollout. Never publish locally.

</details>
